// This example server MUST be run on another machine on your local
// network. This is because it must be run from the exact same port
// as the malicious website (in this case, /examples/example-launcher.html).
// In order to trick web browser's into violating same-origin policy the domain
// name of the target server must be EXACTLY the same as the malicious website
// launching the attack. If we were serving this from a different port that
// would violate the same-origin request. Sorry folks, hope you've got another
// machine you could run this on. Otherwise, you could just trust me that the
// example works ;)

const http = require('http')
const url = require('url')

const port = 3000
const secrets = {
    username: 'crashOverride',
    password: 'hacktheplanet!'
}

const requestHandler = (req, res) => {
    const path = url.parse(req.url).pathname
    console.log(req.method, req.url)

    res.setHeader('Server', 'Example Vulnerable Server v1.0')
    if (path == '/auth.json') {
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(secrets))
    } else {
        res.statusCode = 404
        res.end('Not found. Maybe you should look for auth.json ;)')
    }
}

const server = http.createServer(requestHandler)

server.listen(port, (err) => {
    if (err) throw err
    console.log(`vulnerable server is listening on ${port}`)
})
