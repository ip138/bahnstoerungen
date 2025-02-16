// First define some HACON constants ;-)
// HACON coordinate factor
var haconFactor = Math.pow(10, 6);

var startLatitude = 50.9; // initial latitude of the center of the map
var startLongitude = 10.7; // initial longitude of the center of the map
var startZoom = 8; // initial zoom level

// If a popup of a marker is open, the markers are not reloaded because disappearing popus confuse users.
var popupOpen = false;
// If the user has already seen the message of the day, this variable is set to false.
var seenMotD = false;
// List of messages of the day – there can be multiple but it is very very rare.
var motDInnerHTML = [];

// define base map and overlays
var markers = L.layerGroup([]);
var oldMarkers = L.layerGroup([]);
var regionMarkers = L.layerGroup([]);
var ORMTilesLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
//    maxZoom: 18,
    maxZoom: 18
//    attribution: '<a href="http://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>, Style: <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA 2.0</a> <a href="http://www.openrailwaymap.org/">OpenRailwayMap</a> and OpenStreetMap'
});
var osmOrgTilesLayer = L.tileLayer("//{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19
//    attribution: 'Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, imagery CC-BY-SA'
});

// set current layer
var currentBaseLayer = osmOrgTilesLayer;


// layer control
var baseLayers = {'OSM Carto': osmOrgTilesLayer};
var overlays = {'OpenRailwayMap Infrastructure': ORMTilesLayer, 'Interruptions': markers, 'Previous Interruptions': oldMarkers, 'Region-wide Messages': regionMarkers};
var overlaysMeta = {
    'OpenRailwayMap Infrastructure': 'orm_infrastructure',
    'Interruptions': 'markers',
    'Previous Interruptions': 'oldMarkers',
    'Region-wide Messages': 'regionMarkers'
};

var activeLayers = [];
var defaultOverlays = ['markers', 'oldMarkers', 'regionMarkers'];
var initialLayers = [osmOrgTilesLayer];

var DisruptionIcon = L.Icon.extend({
    options: {
        shadowUrl: 'images/marker-shadow.png',
	iconSize: [25, 41],
	iconAnchor: [12.5, 41],
        popupAnchor: [1, -34],
        tooltipAnchor: [16, -28],
        shadowSize: [41, 41]
    }
});

var RegionMessageIcon = L.Icon.extend({
    options: {
        shadowUrl: 'images/region-shadow.svg',
	iconSize: [30, 28],
	iconAnchor: [12, 14],
        popupAnchor: [3, -14],
        tooltipAnchor: [11, -18],
        shadowSize: [45, 32]
    }
});

function getLayerNameByID(layerID) {
    var name = '';
    Object.keys(overlaysMeta).forEach(function(key){
        if (overlaysMeta[key] == layerID) {
            name = key;
        }
    });
    return name;
}

function parseUrl(url) {
    var keyValues = location.hash.substr(1).split("&");
    var queryParams = {};
    keyValues.forEach(function(item) {
        var kV = item.split('=');
        if (kV.length == 1) {
            queryParams[item] = '';
        } else {
            try {
                queryParams[kV[0]] = decodeURIComponent(kV[1]);
            } catch (e) {
                console.error(e)
            }
        }
    });
    // set default overlays
    var wantedOverlays = defaultOverlays;
    if (queryParams.hasOwnProperty('overlays')) {
        wantedOverlays = queryParams['overlays'].split(',');
    }
    wantedOverlays.forEach(function(layerID) {
        // get layer name
        var wantedName = getLayerNameByID(layerID);
        if (wantedName != '') {
            initialLayers.push(overlays[wantedName]);
            activeLayers.push(wantedName);
        }
    });

    // set lat, lon, zoom
    if (queryParams.hasOwnProperty('zoom') && !isNaN(queryParams['zoom'])) {
        startZoom = queryParams['zoom'];
    }
    if (queryParams.hasOwnProperty('lat') && !isNaN(queryParams['lat']) && queryParams.hasOwnProperty('lon') && !isNaN(queryParams['lon'])) {
        startLatitude = queryParams['lat'];
        startLongitude = queryParams['lon'];
    }
}

parseUrl();
var mymap = L.map('mapid', {
    center: [startLatitude, startLongitude],
    zoom: startZoom,
    layers: initialLayers,
    attributionControl: false
});
var layerControl = L.control.layers(baseLayers, overlays);
var attributionControl = L.control.attribution();
attributionControl.addTo(mymap);
layerControl.addTo(mymap);


function updateAttribution() {
    attributionControl.remove();
    attributionControl = L.control.attribution();
    attributionControl.addAttribution('Basic Map © <a href="//www.openstreetmap.org/copyright">OpenStreetMap</a> contributors (<a href="https://opendatacommons.org/licenses/odbl/index.html">ODbL</a>), Map Graphics <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>')
    if (activeLayers.indexOf('OpenRailwayMap Infrastructure')  != -1) {
        attributionControl.addAttribution('Network Map: CC-BY-SA <a href="http://openstreetmap.org/copyright">OpenStreetMap</a> and <a href="http://www.openrailwaymap.org">OpenRailwayMap</a>');
    }
    if (activeLayers.indexOf('Interruptions') != -1 || activeLayers.indexOf('Previous Interruptions') != -1 || activeLayers.indexOf('Interruptions') != -1) {
        attributionControl.addAttribution('Interruptions: DB Netz');
    }
    attributionControl.addTo(mymap);
}

updateAttribution();



function escapeHTML(input) {
   return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// functions executed if the layer is changed or the map moved
function updateUrl(newBaseLayerName, overlayIDs) {
    if (newBaseLayerName == '') {
        newBaseLayerName = 'OSM Carto';
    }
    var origin = location.origin;
    var pathname = location.pathname;
    var newurl = origin + pathname + '#overlays=' + overlayIDs + '&zoom=' + mymap.getZoom() + '&lat=' + mymap.getCenter().lat.toFixed(6) + '&lon=' + mymap.getCenter().lng.toFixed(6);
    history.replaceState('', document.title, newurl);
}

function currentBerlinTime() {
    var currentTime = new Date();
    var utcTime = {year : currentTime.getUTCFullYear(), month : currentTime.getUTCMonth(), day : currentTime.getUTCDate(), hour : currentTime.getUTCHours(), minute : currentTime.getUTCMinutes()};
    var m = moment.tz(utcTime, 'UTC');
    return m.tz("Europe/Berlin");
}

function formatHimDate(date, time) {
    var m = moment(date + '_' + time, 'YYYYMMDD_HHmmss');
    return m.format('DD.MM.YYYY HH:mm');
}

function setPopupStateOpen() {
    popupOpen = true;
}
function setPopupStateClosed() {
    popupOpen = false;
}

function showTrainsForHandler(ev) {
    var xhr = new XMLHttpRequest();
    var url = "https://uts.azure-api.net/strecken-info-proxy/mgate";
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.responseType = "json";
    var oldElement = document.querySelector('[data-himid="' + ev.target.dataset.himid + '"]');
    var newElement = document.createElement('p');
    xhr.onreadystatechange = function() {
        if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
            var trainList = [];
            console.log(xhr.response);
            var trainDataList = xhr.response['svcResL'][0]['res']['common']['himL'][0]['affJnyL'];
            trainDataList.forEach(function(e){
                var parts = e['jid'].split('#');
                trainList.push(escapeHTML(parts[30] + ' (' + parts[26] + ' ' + parts[28] + ')'));
            });
            newElement.innerHTML = 'Affected Trains:<br>' + trainList.join('<br>');
            oldElement.parentNode.replaceChild(newElement, oldElement);
        }
    }
    queryData = '{"ver":"1.15","lang":"deu","auth":{"type":"AID","aid":"hf7mcf9bv3nv8g5f"},"client":{"id":"DBZUGRADARNETZ","type":"WEB","name":"webapp","v":"0.1.0"},"formatted":false,"svcReqL":[{"meth":"HimDetails","req":{"input":"' + ev.target.dataset.himid + '","getTrains":true}';
    queryData = queryData + ',"cfg":{"cfgGrpL":[],"cfgHash":"i74dckao7PmBwS0rbk0p"}}],"ext":"DBNETZZUGRADAR.2"}';
    xhr.send(queryData);
}

function registerShowTrains() {
    var popups = document.getElementsByClassName('show-trains');
    for (var i = 0; i < popups.length; ++i) {
        popups[i].addEventListener('click', showTrainsForHandler);
    };
}


function addMarker(markerLat, markerLon, message, spatialContext, endOfEvent, localEvent, himId) {
    var nowTime = currentBerlinTime();
    var historic = false;
    if (endOfEvent.isBefore(nowTime)) {
	historic = true;
    }
    var markerIcon = new DisruptionIcon({iconUrl: 'images/marker-red.svg'});
    if (historic == true && localEvent) {
	markerIcon = new DisruptionIcon({iconUrl: 'images/marker-grey.svg'});
    } else if (!historic && !localEvent) {
	markerIcon = new RegionMessageIcon({iconUrl: 'images/region-red.svg'});
    } else if (historic && !localEvent) {
	markerIcon = new RegionMessageIcon({iconUrl: 'images/region-grey.svg'});
    }
    var marker = L.marker([markerLat, markerLon], {icon: markerIcon});
    marker.bindPopup('<div class="disruption-popup-content">' + escapeHTML(spatialContext) + '<br>' + message + '</div><a class="show-trains" href="#" data-himid="' + himId + '">Show affected trains</a>');
    marker.on('popupopen', function(){setPopupStateOpen(); registerShowTrains();});
    marker.on('popupclose', setPopupStateClosed);
    if (localEvent && historic) {
        oldMarkers.addLayer(marker);
    } else if (localEvent && !historic) {
        markers.addLayer(marker);
    } else {
        regionMarkers.addLayer(marker);
    }
}

L.Control.InfoIcon = L.Control.extend({
    onAdd: function(map) {
        var info = L.DomUtil.create('img');
        //L.DomUtil.addClass('leaflet-control-layers');
        info.src = 'images/info.svg';
        info.style.width = '36px';
        info.style.height= '36px';
        info.setAttribute('id', 'info');
        info.addEventListener('click', showMessageOfTheDay);
        return info;
    },

    onRemove: function(map) {
        // Nothing to do here
    }
});

function closeMessageOfTheDay() {
    document.getElementById('motd_overlay').style.display = 'none';
    document.getElementById('mapid').style.display = 'block';
    document.body.style.position = 'fixed';
    seenMotD = true;
    L.control.InfoIcon = function(opts) {
        return new L.Control.InfoIcon(opts);
    }
    L.control.InfoIcon({ position: 'topright' }).addTo(mymap);
}

function showMessageOfTheDay() {
    var infoIcon = L.DomUtil.get('info');
    if (infoIcon != null) {
        L.DomUtil.remove(infoIcon);
    }
    //infoIcon.remove();
    //info.style.visibility = 'hidden';
    document.getElementById('motd_text').innerHTML = '<div class="motd-block">' + motDInnerHTML.join('</div><div class="motd-block">') + '</div>';
    document.getElementById('motd_overlay').style.display = 'block';
    document.getElementById('motd_overlay').addEventListener('click', function(event){event.stopPropagation();});
    document.getElementById('motd_overlay').addEventListener('mousedown', function(event){event.stopPropagation();});
    document.getElementById('motd_overlay').addEventListener('mouseup', function(event){event.stopPropagation();});
    document.getElementById('motd_overlay').addEventListener('dblclick', function(event){event.stopPropagation();});
    document.getElementById('mapid').style.display = 'none';
    document.body.style.position = 'static';
}


document.getElementById('close_icon').addEventListener('click', closeMessageOfTheDay);

function findAndMakeLinks(text) {
    var regexp = new RegExp('(https?://[^ ]+[^ .,])')
    return text.replace(regexp, '<a href="$1" target="_blank">$1</a>');
}

function displayMarkers(responseFromServer) {
    // remove all existing markers
    markers.clearLayers();
    oldMarkers.clearLayers();
    regionMarkers.clearLayers();

    var responseData = responseFromServer.svcResL[0].res.common;
    if (!("himL" in responseFromServer.svcResL[0].res.common)) {
        // there are no disruptions
        return;
    }
    var allHimL = responseFromServer.svcResL[0].res.common.himL;
    var allEdges = responseFromServer.svcResL[0].res.common.himMsgEdgeL;
    var allEvents = responseFromServer.svcResL[0].res.common.himMsgEventL;
    var allLocations = responseFromServer.svcResL[0].res.common.locL;
    var allRegions = responseData['himMsgRegionL'];
    var addMarkersToMap = function(element, index) {
        if (element.cat != 0) {
            // only unplanned disruptions
            return;
        }
        if (!element.hasOwnProperty('head') && !element.hasOwnProperty('text')) {
            // A message without a category for a reason and a detailed description is strange.
            // This happens if a large disruption is over. Skip it.
            return;
        }
	//TODO support different impacts for different traffic classes
        var himId = element.hid || null;
        var message = '<b>' + escapeHTML(element.impactL[0].impact || '') + '<br>' + escapeHTML(element.head || '') + '</b>';
        // add time
        var lastDurationString = '';
        var lastEndOfEvent;
        for (var i = 0; i < element.eventRefL.length; i++) {
            var thisEvent = allEvents[element.eventRefL[i]];
            lastEndOfEvent = moment.tz(thisEvent.tDate + thisEvent.tTime, 'YYYYMMDDHHmmss', 'Europe/Berlin');
            var durationString = formatHimDate(thisEvent.fDate, thisEvent.fTime) + ' to approx. ' + formatHimDate(thisEvent.tDate, thisEvent.tTime);
            if (lastDurationString != durationString) {
                message = message + '<br>' + durationString;
                lastDurationString = durationString;
            }
        }
        if (element.hasOwnProperty('lModDate')) {
            message = message + '<br>last update: ' + formatHimDate(element.lModDate, element.lModTime);
        }
        if (element.hasOwnProperty('text')) {
            message = message + '<br>' + findAndMakeLinks(element.text);
        }
        if (element.hasOwnProperty('prio') && element.prio == 1) {
            motDInnerHTML.push(message);
            if (!seenMotD) {
                showMessageOfTheDay();
            }
            return;
        }
	var markerLat, markerLon;
        var addMarkerAndLine = function(edgeRef) {
            var thisEdge = allEdges[edgeRef];
            markerLat = thisEdge.icoCrd.y / haconFactor;
            markerLon = thisEdge.icoCrd.x / haconFactor;
            // add location
            var fromLoc = thisEdge.fLocX;
            var toLoc = thisEdge.tLocX;
            var spatialContext = allLocations[fromLoc].name;
            if (typeof(toLoc) != undefined && fromLoc != toLoc) {
                spatialContext = spatialContext + '–' + allLocations[toLoc].name;
            }
            addMarker(markerLat, markerLon, message, spatialContext, lastEndOfEvent, true, himId);
        }
	if (element.hasOwnProperty('edgeRefL')) {
            element.edgeRefL.forEach(addMarkerAndLine);
	} else if (element.hasOwnProperty('regionRefL') && element.regionRefL.length > 0) {
            markerLat = allRegions[element.regionRefL[0]].icoCrd.y / haconFactor;
            markerLon = allRegions[element.regionRefL[0]].icoCrd.x / haconFactor;
            var spatialContext = allRegions[element.regionRefL[0]].name;
            addMarker(markerLat, markerLon, message, spatialContext, lastEndOfEvent, false, himId);
	} else {
	    return;
	}
    }
    motDInnerHTML = [];
    allHimL.forEach(addMarkersToMap);
    showLoading(false);
}

function himDate(inputTime, offsetHours) {
    return inputTime.format("YYYYMMDD")
}

function himTime(inputTime, offsetHours) {
    return inputTime.format('HH') + '0000'; }

function leafletBoundsToHacon(bounds) {
    var haconBounds = {'rect': { 'llCrd': {}, 'urCrd': {}}};
    haconBounds.rect.llCrd.x = bounds.getWest() * haconFactor;
    haconBounds.rect.llCrd.y = bounds.getSouth() * haconFactor;
    haconBounds.rect.urCrd.x = bounds.getEast() * haconFactor;
    haconBounds.rect.urCrd.y = bounds.getNorth() * haconFactor;
    return haconBounds;
}

function showLoading(turnOn) {
        var loading = document.getElementById('loading');
    if (turnOn) {
        loading.style.visibility = 'visible';
    } else {
        loading.style.visibility = 'hidden';
    }
}

/**
 * Fetch disruption data (HimGeoPos request) from the API.
 */
function getDisruptionData() {
    if (popupOpen == true) {
        // Don't reload the markers if any popup is open.
        return;
    }
    showLoading(true);
    var xhr = new XMLHttpRequest();
    var url = "https://uts.azure-api.net/strecken-info-proxy/mgate";
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    xhr.responseType = "json";
    xhr.onreadystatechange = function() {
        if(xhr.readyState == XMLHttpRequest.DONE && xhr.status == 200) {
            displayMarkers(xhr.response);
            showLoading(false);
        }
    }
    // get current time
    var berlinTime = currentBerlinTime();
    var dateB = himDate(berlinTime, 0);
    var timeB = himTime(berlinTime, 0);
    berlinTime.add(6, 'hours');
    var dateE = himDate(berlinTime, 6);
    var timeE = himTime(berlinTime, 6);
    var bounds = mymap.getBounds();
    queryData = '{"ver":"1.15","lang":"deu","auth":{"type":"AID","aid":"hf7mcf9bv3nv8g5f"},"client":{"id":"DBZUGRADARNETZ","type":"WEB","name":"webapp","v":"0.1.0"},"formatted":false,"svcReqL":[{"meth":"HimGeoPos","req":{"prio":100,"maxNum":5000,"getPolyLine":true,';
    queryData = queryData + '"rect":' + JSON.stringify(leafletBoundsToHacon(bounds).rect) + ',';
    queryData = queryData + '"dateB":"' + dateB + '","timeB":"' + timeB + '","dateE":"' + dateE + '","timeE":"' + timeE;
    queryData = queryData + '","onlyHimId":false,"himFltrL":[{"type":"HIMCAT","mode":"INC","value":"0"}';
    queryData = queryData + ',{"type":"PROD","mode":"INC","value":1023}]}';
    queryData = queryData + ',"cfg":{"cfgGrpL":[],"cfgHash":"i74dckao7PmBwS0rbk0p"}}],"ext":"DBNETZZUGRADAR.2"}';
    xhr.send(queryData);
}

function getCurrentOverlays() {
    var overlaysIDs = [];
    activeLayers.forEach(function(layerName){
        overlaysIDs.push(overlaysMeta[layerName]);
    });
    return overlaysIDs.toString();
}

// change URL in address bar if the map is moved
mymap.on('moveend', function(e) {
    updateUrl('', getCurrentOverlays());
    getDisruptionData();
});

// change URL in address bar an overlay is removed
mymap.on('overlayremove', function(e) {
    // remove from activeLayers
    activeLayers.splice(activeLayers.indexOf(e.name), 1);
    // update URL
    updateUrl('', getCurrentOverlays());
    updateAttribution();
});

mymap.on('overlayadd', function(e) {
    // add to activeLayers
    activeLayers.push(e.name);
    updateUrl('', getCurrentOverlays());
    updateAttribution();
});

getDisruptionData();
