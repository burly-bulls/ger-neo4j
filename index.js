// this needs to be here so that node doesn't throw a warning about a possible memory leak where there actually is none.
require('events').EventEmitter.defaultMaxListeners = 100;

var CronJob = require('cron').CronJob;
var Promise = require('bluebird');
var neo4j = require('neo4j-driver').v1;

var queueInstance = require('./queue.js');
var util = require('./util.js');

var driver;

var frequency;


var initNeo4j = function(categories, items, neo4jConfig, cb) {

  cb = cb || function() {};

  frequency = neo4jConfig.frequency || null;

  if ( frequency === 0 ) {
    new CronJob(frequency, function() { // cron job happens every hour
      // will this cause problems? having a while loop in here? should it be in a seperate file?
      while ( queue.size() > 0) {
        saveConfig(queue.dequeue());
      }

    }, null, true, 'America/Los_Angeles');
  } else if ( frequency !== 0) {
    new CronJob('0 0 * * * *', function() { // cron job happens every hour
      // will this cause problems? having a while loop in here? should it be in a seperate file?
      while ( queue.size() > 0) {
        saveConfig(queue.dequeue());
      }

    }, null, true, 'America/Los_Angeles');
  }

  driver = driver = neo4j.driver("bolt://" + neo4jConfig.server, neo4j.auth.basic(neo4jConfig.user, neo4jConfig.password));

  var session = driver.session();
  var promises = [];

  // let's go ahead and add all of the categories to neo4j
  for ( var i = 0; i < categories.length; i++) {
    promises.push(
      new Promise(function(resolve,reject) {
        session
          .run( `MERGE (c:Category { name: {category} })`, {category: categories[i]})
          .then( function() {
            session.close();
            driver.close();
            resolve();
          })
          .catch(function(err) {
            session.close();
            driver.close();
            reject(err);
          });
      })
    )
  }

  // let's also add all of the items
  for ( var i = 0; i < items.length; i++) {
    promises.push(
      new Promise(function(resolve,reject) {
        session
          .run( `MERGE (i:Item { name: {item} })`, {item: items[i]})
          .then( function() {
            session.close();
            driver.close();
            resolve();
          })
          .catch(function(err) {
            session.close();
            driver.close();
            reject(err);
          });
      })
    )
  }

  // this is going to store the properties of the item-item relationship
  var categoryObject = [];

  // now we are going to go through each category and create a relationship to each item
  for ( var i = 0; i < categories.length; i++) {
    categoryObject.push( 'r.' + categories[i].toLowerCase() + 'Value = 0')
    for ( var j = 0; j < items.length; j++) {
      promises.push(
        new Promise(function(resolve,reject) {
          session
            .run(`MATCH (c:Category { name: {category} }), (i:Item { name: {item} }) MERGE (c)-[:HAS]->(i)`, {category: categories[i], item: items[j]})
            .then( function() {
              session.close();
              driver.close();
              resolve();
            })
            .catch(function(err) {
              session.close();
              driver.close();
              reject(err);
            });
        })
      )
    }
  }

  // here we create the properties for the relationship between the items
  var categoryQueryString = categoryObject.join(',');

  // now we are going to relate each item to all of the other items, with the values for the categories on the relationship
  for ( var k = 0; k < items.length; k++) {
    promises.push(
      new Promise(function(resolve,reject) {
        session
          .run(`MATCH (n:Item {name: {item}}),(p:Item) WHERE NOT n.name = p.name MERGE (n)-[r:RECOMMENDS]->(p) ON CREATE SET ${categoryQueryString} RETURN n,p`, {item: items[k] })
          .then( function() {
            session.close();
            driver.close();
            resolve();
          })
          .catch(function(err) {
            session.close();
            driver.close();
            reject(err);
          });
      })
    )
  }
  Promise.all(promises)
  .then(function() {
    cb(null, 'neo4j initialized, recommendations are ready');
  })
  .catch(function(e) {
    cb(e);
  });
}

var queue = queueInstance();

var queueConfig = function(config) {
  if ( frequency === 0 ) {
    saveConfig(config);
  } else {
    queue.enqueue(config);
  }
}

var saveConfig = function(config) { // config = {category: 'React', items: ['cssmin', 'watch']}
  if (!config) {
    return;
  };

  addItem({
    items: config.items,
    category: config.category
  });
}

var getRecommendations = function(config, cb) {
  var session = driver.session();
  if (!config) {
    return;
  }

  var storage = {};
  var promises = [];
  var result = [];

  config.items.forEach(function(item) {
    promises.push(
      new Promise(function(resolve,reject) {
        session
          .run( `MATCH (a:Item {name: {itemName}})-[r:RECOMMENDS]->(b:Item) WHERE NOT b.name IN {otherItems} RETURN properties(a),properties(r),properties(b)`, { itemName: item, otherItems: config.items } )
          .then( function( result ) {
            if ( result.records.length > 0 ) {
              result.records.forEach(function(record) {
                var name = record._fields[2].name;
                var value = record._fields[1][`${config.category.toLowerCase()}Value`].toInt();
                if ( storage[name] ) {
                  storage[name] += value;
                } else {
                  storage[name] = value;
                }
              });
            }
          })
          .then(() => {
            session.close();
            driver.close();
            resolve();
          })
          .catch(function(err) {
            session.close();
            driver.close();
            reject(err);
          });
      })
    )
  });

  Promise.all(promises).then(() => {
    for ( var k in storage ) {
      result.push({name: k, value: storage[k]})
    }
    cb(null, result.sort(function(a, b) {
      return b.value - a.value
    }))
  })
  .catch(function(e) {
    cb(new Error(e));
  });
}

var addItem = function(config) {
  var session = driver.session();
  if (config.items.length < 2) {
    return;
  }
  var uniqueCombinations = util.combination(config.items, 2);
  for ( var i = 0; i < uniqueCombinations.length; i++) {
    session
      .run( `MATCH (a:Item {name: {item1} })-[r:RECOMMENDS]-(b:Item {name: {item2} }) SET r.${config.category.toLowerCase()}Value = r.${config.category.toLowerCase()}Value + 1`, {item1: uniqueCombinations[i][0], item2: uniqueCombinations[i][1]})
      .then( function( result ) {
        result.records.forEach(function(record) {
          var name = record._fields[2].name;
          var value = record._fields[1][`${config.category.toLowerCase()}Value`].toInt();
          if ( storage[name] ) {
            storage[name] += value;
          } else {
            storage[name] = value;
          }
        });
        session.close();
        driver.close();
      })
      .catch(function(err) {
        session.close();
        driver.close();
      });
  }
}

module.exports = {
  getRecommendations: getRecommendations,
  queueConfig: queueConfig,
  init: initNeo4j
}