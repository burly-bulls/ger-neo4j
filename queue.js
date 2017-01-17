module.exports = function() {
  var instance = {};
  var storage = {};
  var start = 0;
  var end = 0;

  instance.enqueue = function(value) {
    storage[end++] = value;
  };

  instance.dequeue = function() {
    var result = storage[start];
    delete storage[start];
    instance.size() && start++;
    return result;
  };

  instance.size = function() {
    return end - start;
  };

  return instance;
};