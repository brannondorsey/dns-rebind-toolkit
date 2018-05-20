# Frequently Asked Questions

Got a question about the DNS rebinding attacks or how this toolkit works? Check below to see if it's been answered. If not peruse the open issues and if you don't find an answer there, feel free to post a new issue.

## Can I target services that don't speak HTTP?

Best I can tell, no. DNS rebinding attacks require the web browser to function as a sort of proxy to the target LAN. You are therefore restricted to use the kinds of communication allowed by the browser to communicate to the vulnerable device. We browsers don't provide a TCP or UDP stack that you would have access to.

## Can I target services that use HTTPS?

No. DNS rebinding attacks only work against plaintext HTTP. A certificate error would be thrown by your browser when it notices that the victim service's certificate doesn't match the certificate on rebind.network (I don't even have a cert on that box).

## How can I tell if a service is vulnerable?

If an HTTP API or service is available on your local network (or the WAN for that matter) and it 1) doesn't use HTTPS and 2) doesn't seem to have any authorization limiting access, it may be vulnerable. The easiest way to check is to open up your web browser and navigate to the service in question, e.g. `http://192.168.1.7:8888`. Now, try and access the same service using a domain name provided by a [whonow](https://github.com/brannondorsey/whonow) server running at rebind.network, `http://A.192.168.1.7.forever.rebind.network:8888`. If the service is still available at that domain name, it's vulnerable to a DNS rebinding attack.

## The WebRTC leak provided by `DNSRebindAttack.getLocalIPAddress()` isn't working.

It doesn't work in all browsers. Last time I checked Firefox protected against it. I usually fall back to a common network subnet like `192.168.1.0/24`.

```javascript
DNSRebindAttack.getLocalIPAddress()
.then(ip => launchRebindAttack(ip))
.catch(err => {
    console.error(err)
    // Looks like our nifty WebRTC leak trick didn't work (doesn't work
    // in Firefox). No biggie, most home networks are 192.168.1.1/24 anyway.
    launchRebindAttack('192.168.1.1')
})

function launchRebindAttack(localIp) {
    
    // convert an IP like 192.168.1.1 into array from 192.168.1.0 - 192.168.1.255
    const first3Octets = localIp.substring(0, localIp.lastIndexOf('.'))
    const ips = [...Array(256).keys()].map(octet => `${first3Octets}.${octet}`)
    
    // do some nasty stuff...
}
```
