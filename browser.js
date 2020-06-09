//////////////////////////////////////////
module.exports = function (req, res, next) {
  // Make endpoints viewable in the browser
  // (Forces GET to POST for the purpose of seeing PerCL)
  if (req.method === 'GET' && req.headers.host === 'localhost') req.method = 'POST'
  next()
}
//////////////////////////////////////////
