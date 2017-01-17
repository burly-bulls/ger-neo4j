# ger-neo4j
A good enough recommendation engine using the neo4j graph database

## Note
As noted above, you need access to neo4j for this plugin to work. To get neo4j up and running, check out [their website](https://neo4j.com/).

## Usage

```sh
# install ger-neo4j
npm install --save ger-neo4j


# require it in your app
var filter = require('ger-neo4j');

# initialize ger-neo4j
#/**
# * @param {array} categories - array of categories for the items - required
# * @param {array} items - array of items for the items - required
# * @param {object} config - config for the setup of neo4j; needs server, user, password properties
#          to login to neo4j. Also accepts a frequency property to dictate when to clear the config.
#          Set to 0 if you don't want a delay, or use the following format to use a custom timeframe:
#          https://www.npmjs.com/package/cron
# * @param {function} callback - a call back function that get's called on success or error
# **/
filter.init(Categories, Items, config, function(err, msg) {
  if ( err ) {
    console.log(err);
  } else {
    console.log(msg);
  }
});
```

Once initialized, you can add an object with the category and an array of items you want related to the database with queueConfig.

Adding a relationship

```sh
#/**
# * @param {Obecjt} category, items - object containing a category property that takes a string
#          and an items propetrty that takes an array
# **/
queueConfig({category: 'Category', items: ['items1', 'items2', 'items3']})
# NOTE: by default, these are added to a queuue that is cleared every hour unless
# dictated above in the config given to init
```

Asking for Recommendations

```sh
# * @param {Obecjt} category, items - object containing a category property that takes a string
#          and an items propetrty that takes an array
# * @param {function} callback - a call back function that get's called on success with
#          recommendations or an error
getRecommendations({category: 'Category', items: ['items1', 'items2']}, function(err, recommendations) {
  if ( err ) {
    console.log(err);
  }
  console.log(recommendations);
})
```

## Troubleshooting
[please open an issue through github](https://github.com/burly-bulls/ger-neo4j/issues)