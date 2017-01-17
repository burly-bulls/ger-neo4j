module.exports.combination = function(arr, num) {
  var r = [];

  for(var i = 0 ; i < arr.length ; i++) {

    if(num===1) {
      r.push([arr[i]]);
    } else {
      this.combination(arr.slice(i+1), num-1).forEach(function(val) {
        r.push([].concat(arr[i], val));
      });
    }
  }
  return r;
}