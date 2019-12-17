// ----------------- START FIREBASE RELATED THINGS -----------------------

// this will create a node in the real time storage and start storing neurons and maps with your username with it
let username = "abhishek";

var config = {
    apiKey: "AIzaSyBUiMBQonLTuVeQ827RQJcd_Nqz_IgrIXo",
    authDomain: "mind-map-data.firebaseapp.com",
    databaseURL: "https://mind-map-data.firebaseio.com",
    projectId: "mind-map-data",
    storageBucket: "mind-map-data.appspot.com",
    messagingSenderId: "840605340675",
    appId: "1:840605340675:web:2b3b13899ee06d9a4dea36",
    measurementId: "G-5KF1JHNKZ3"
};

const app = firebase.initializeApp(config);
const appDb = firebase.firestore();
let realtimeStorage = firebase.database();

function addDataIntoFirebase(area, data) {

    if (area === "map" && data.mapArr && data.mapArr[0].tabId === undefined) {
        data.mapArr = data.mapArr.splice(0, 1);
    }

    let ref = "";
    let key = (String(new Date())).substring(0, (String(new Date())).indexOf("GMT"));

    switch (area) {
        case "map":
            ref = "mindMap";
            break;
        case "neuron":
            ref = "neuron";
            break;
        case "neuronActivity":
            ref = "neuronActivity";
            break;
        case "sessions":
            ref = "sessions";
            break;
    }

    ref = ref + "/" + username + "/";

    if (area === "neuron" && data.url.indexOf("localhost") < 0 && data.url.indexOf("mindtree") < 0) {
        realtimeStorage.ref(ref + key).set(data);
    }

}


// $FIREBASE-------------------- FIREBASE RELATED FUNCTIONS ENDS -------------------


// ----------------------  VARIABLE DECLARATION AND INITIALIZATION STARTS ---------------


// This code is going to be for managing the chrome tabs

let currentMap = [];
let currentActiveTabId = -1;
let currentMapObj = {
    id: 0,
    mapStartTimeStamp: ' ',
    // chrome instance tells us if the maps are from a closed chrome window when every tabid gets updated or not
    chromeInstanceId: '',
    mapEndTimeStamp: '',
    totalNeurons: 0,
    mapArr: [],
    lastNeuroAddOperation: "",
    lastNeuroDeleteOperation: ""
};


// previous maps variable is going to be a list of lists which will ultimately go into storage
let currentHistoryObj = {};
let globalMapIdx = -1;
let currentSessionMaps = [];
let redundantMapsFromSession = [];
let mapId = 0;

// this object will contain the chrome window and the session maps that are going to be inside that window
let currentWindowMaps = {
    windowId: "",
    sessionMaps: [],
    activity: [],
    tabAndUrlState: {}
};

let dataFromStorage = {
    data: "nada"
};

let blocklUrlList = ["mindtree", "localhost"];


// $VAR--------------------- VARIABLE DECLARATION AND INITIALIZATION ENDS ----------------------------


// ------------------------ CHROME API CALLING START HERE --------------------

// HISTORY API calls ->
chrome.history.onVisited.addListener(historyAdded);


// TABS API calls ->

chrome.tabs.onRemoved.addListener(tabRemoved);
chrome.tabs.onCreated.addListener(onTabCreated);
chrome.tabs.onActivated.addListener(activeTab);
// showAllTheTabs();
getCurrentMap();
chrome.tabs.getCurrent(function(tab) {
    logConsoleInto(2, tab);
});


// WINDOW API calls ->


chrome.windows.onRemoved.addListener(onWindowClosed);
// chrome.windows.onCreated.addListener(onTabCreated);
// chrome.tabs.onDetached.addListener(onTabMovement);


// $CHROME----------------- CHROME API CALLING ENDS ---------------------


// --------------------- BACKGROUND FUNCTIONS START HERE -------------------------


startup();

// what is going to happen when the extension is going to start
async function startup() {

    // storing the current window object with this data
    chrome.windows.getCurrent((val) => {
        currentWindowMaps.windowId = val.id;
        currentWindowMaps.activity.push({
            birth: new Date()
        });
    });

    let tabRecord = {};
    let generalIndex = 0;

    chrome.tabs.query({},
        function(tabs) {
            tabs.forEach(tab => {
                tabRecord[generalIndex++] = tab.url;
            });
        }
    );

    await getFromLocalStorage('current');


    // startup steps

    // 1 look for maps into storage

    // 2 if found, then verify if it is one or more than one.

    // if one, then verify the fetched map with the opened tabs

    // if found to be same, replace the stored tab, window ids with the updated and continue.

    // if found to be different, create another fresh instance of the loaded stuff as unmapped and push

    // if there are more than one stored windowMaps, then check for the one matching and then continue

    return;
}


intializeNewMap("fresh");

function intializeNewMap(startingNeuron) {

    if (startingNeuron === "fresh") {

        currentMap = [];

    } else if (startingNeuron["url"]) {

        currentMap = [startingNeuron];

    }

    // resetting all the parameters of the currentMapObject

    currentMapObj.mapStartTimeStamp = new Date();
    currentMapObj["practicalTime"] = getPracticalDateTime(currentMapObj.mapStartTimeStamp);
    currentMapObj.id = ++mapId;
    currentMapObj.mapEndTimeStamp = "";
    currentMapObj.totalNeurons = 0;
    currentMapObj.mapArr = [];

    globalMapIdx = 0;

    logConsoleInto(1, "new map object initialized: ");
    logConsoleInto(2, currentMapObj)

}





async function historyAdded(history) {
    let historyUrl = history.url;
    logConsoleInto(2, history);

    if (history.title.length > 0) {
        currentHistoryObj = history;
    } else if (isNotGoogleSearch(history)) {
        currentHistoryObj = history;
    }

    // getting the transition state of the history link
    chrome.history.getVisits({
        "url": historyUrl
    }, addNeuronWithTransition)

    // showAllTheTabs();
}

async function addNeuronWithTransition(visitObject) {
    addNueroToMap(currentHistoryObj, visitObject[0].transition);
}

// the below functions will be processing the info that the above functions throw.


async function addNueroToMap(neuroObj, transition) {

    if (noDuplicateNeuron(neuroObj)) {

        neuroObj["mapIndex"] = ++globalMapIdx;
        neuroObj["virgin"] = true;
        neuroObj["tabId"] = await getTabId(neuroObj, globalMapIdx, neuroObj["mapIndex"]);
        neuroObj["bornTime"] = new Date();
        neuroObj["transition"] = transition;
        neuroObj["life"] = [{
            birth: new Date()
        }];
        neuroObj["activity"] = {}
        if (currentActiveTabId >= 0) {
            neuroObj["fromTab"] = currentActiveTabId;
        }
        neuroObj.lastVisitTime = new Date(neuroObj.lastVisitTime);
        currentMapObj.lastNeuroAddOperation = (new Date()).getTime();

        pushIntoCurrentMap(neuroObj);

    }
}

// this will not push neurons which are not part of the block list
function pushIntoCurrentMap(mapObj) {

    let neuronAvoidValue = 0;
    blocklUrlList.forEach((url, index) => {
        if (mapObj.url && mapObj.url.indexOf(url) >= 0) {
            ++neuronAvoidValue;
        }

        if (index === blocklUrlList.length - 1 && neuronAvoidValue === 0) {
            logConsoleInto(5, "can be pushed into the map");
            currentMap.push(mapObj);
        }
    });
}

function updateTransitionState(neuroId, state) {
    currentMap[neuroId].transition = state;
}


function noDuplicateNeuron(neuroObj) {
    let dublicate = 0;

    // for google search for beginning of the map
    if (neuroObj.title && neuroObj.title.toLowerCase().indexOf("google search") >= 0) {
        currentMap.forEach(map => {

            if (map.title === neuroObj.title) {
                ++dublicate;
            }
        });

        if (dublicate >= 1) {
            logConsoleInto(1, "duplicate");
            return false;
        } else {
            logConsoleInto(1, "fresh visit");
            return true;
        }
    } else {

        let duplicateMapValueIndex = 0;

        let duplicate = searchInAllMaps("neuron", neuroObj);

        if (dublicate.place === "current") {
            // now checking if the duplicated url is a return back or not

            if ((new Date()).getMinutes() - currentMap[duplicateMapValueIndex].bornTime.getMinutes() > 0) {
                // this means its coming back to a previous step which should be part of the map that it taken.
                logConsoleInto(1, "return to a previous step");
                return false;
            } else {
                logConsoleInto(1, "duplicate");
                return false;
            }
        } else {
            logConsoleInto(1, "fresh visit for the current map");
            return true;
        }

    }

}

function isNotGoogleSearch(historyObj) {
    // will check if it is a google search or not
    if (historyObj.url.toLowerCase().indexOf("https://www.google.") < 0) {
        return true;
    } else {
        return false;
    }
}

async function activeTab(val) {

    logConsoleInto(1, `tab active = ${val.tabId}`);
    currentActiveTabId = val.tabId;

    let map = searchInAllMaps("tab", val.tabId);

    if (map && map.place) {
        logConsoleInto(2, currentMap);
        if (map.place === "session") {
            await loadCurrentMapIntoSession();
            activateAnotherMap(map.id);
            showCurrentSessionMaps();
        } else {
            // the part where the tab opened is part of the active map
        }
    } else {
        // to handle the case when the opened tab is not part of any map
    }

}

async function tabRemoved(tab) {
    // logConsoleInto(1, "the removed tab is");
    // logConsoleInto(2, tab);

    // let map = searchInAllMaps("tab", tab.id);

    // if (map.place === "current") {
    //     currentMapObj.lastNeuroDeleteOperation = (new Date()).getTime();
    //     currentMap[map.neuronIndex].life.push({
    //         death: new Date()
    //     });

    // } else if (map.place === "session") {
    //     currentSessionMaps[map.sessionMapIndex].lastNeuroDeleteOperation = (new Date()).getTime();
    //     currentSessionMaps[map.sessionMapIndex].mapArr[map.neuronIndex].life.push({
    //         death: new Date()
    //     });
    // }

    // showCurrentSessionMaps(true);
    // checkForRedundantTransfer();
}

async function onTabCreated(val) {
    logConsoleInto(1, `new tab created = ${val.tabId}`);
}

async function onTabMovement(val) {
    // something is always going to happen
}

// this logic is going to fail if there are multiple tabs with same url
// this function will update the tab id once the neuron has been pushed into the current map and then the function analyseAndUpdateMap() will see if it has to be kept or moved to a new map.
async function getTabId(historyObj, originationNeuronIndex, mapIndex) {

    chrome.tabs.query({

        },
        function(tabs) {
            // we are first searching for that url in the list of tabs, then updating that neuron with the tab id
            tabs.forEach(tab => {
                if (tab.url === historyObj.url) {
                    currentMap.forEach((map, index) => {
                        if (map.mapIndex === mapIndex && currentMap && currentMap[index] && currentMap[index].virgin) {
                            currentMap[index]["tabId"] = (tab.id) ? tab.id : "undefined";
                            // this function will run over the map and see the last map, will either do nothing or create a new map out of the last neuron.
                            currentMap[index].virgin = false;
                            addDataIntoFirebase("neuron", currentMap[index]);
                            analyseAndUpdateMap();
                            return tab.id;
                        }
                    });
                }
            });
        });

}

// returns the tab object for knowing if the tab is loading/loaded
function getTabStatus(tabId) {
    chrome.tabs.query({
        // tabs query parameter
    }, function(tabs) {
        return tabs.filter(tab => tab.id)[0];
    });
}

function getCurrentMap() {

    logConsoleInto(1, "active Map: ");
    console.log(currentMap.map(neuron => {
        return {
            url: neuron.url,
            // visitTime: neuron.timestamp,
            transition: neuron.transition,
            tabId: neuron.tabId,
            mapIdx: neuron.mapIndex,
            fromTab: neuron.fromTab,
            practicalTime: getPracticalDateTime(neuron.bornTime),
            // flow: neuron.flow,
            // activity: neuron.activity,
            virgin: neuron.virgin

        };
    }));
}

// can break a map and then see if the last value is a part of the previous map or there is a need to start a fresh map from here
async function analyseAndUpdateMap() {

    let currentNeuron = {};
    let thatNeuronIndex = 0;

    currentMap.forEach((map, index) => {

        if (map.mapIndex === globalMapIdx) {
            currentNeuron = Object.assign({}, map);
            thatNeuronIndex = index;
        }

    });

    if (currentNeuron.url && currentNeuron.fromTab && currentNeuron.tabId && currentNeuron.fromTab === currentNeuron.tabId && (currentNeuron.transition === "typed" || currentNeuron.transition === "generated" || (currentNeuron.transition === "form_submit" && !isNotGoogleSearch(currentNeuron)))) {
        // a new map will start from here with a new object

        loadPreviousStartFresh(currentNeuron, thatNeuronIndex);

    } else if (currentNeuron.url && currentNeuron.fromTab && currentNeuron.tabId && currentNeuron.fromTab === currentNeuron.tabId) {

        if (await checkForRelevantRoute(currentNeuron.url, thatNeuronIndex - 1)) {
            loadPreviousStartFresh(currentNeuron, thatNeuronIndex);
        }

    }
    getCurrentMap();
}

// to load the current map into currentSessionMaps and start a new one
function loadPreviousStartFresh(startingNeuron, indexInPresentMap) {

    // here i am dealing with variable reference problem of JS.
    let currentMapCopy = [];
    let mapObjCopy = Object.assign({}, currentMapObj);

    logConsoleInto(2, mapObjCopy);

    currentMap.forEach((map, index) => {
        if (index < indexInPresentMap) {
            currentMapCopy.push(map);
        }
    });

    if (currentMapCopy.length > 0) {
        mapObjCopy.mapArr = currentMapCopy;
        mapObjCopy.mapEndTimeStamp = "";
        mapObjCopy.totalNeurons = currentMapCopy.length;
        mapObjCopy["firstNeuronUrl"] = mapObjCopy.mapArr[0].url;
    }

    if (mapObjCopy.mapArr.length > 0) {
        addintoCurrentSessionMap(mapObjCopy);
    }

    showCurrentSessionMaps();
    intializeNewMap(startingNeuron);

}

// this will switch the current map when the user will move to any one the maps already there.
function switchCurrentMap(mapId) {
    logConsoleInto(1, "will be initiating a switch now");
}

function loadMapFromData(mapId) {
    // this will load the mind map in the current map from the map id 
}

function removeNeuronFromMap(arrIndex) {
    // have to remove the neuron from the map and create a new map
    getCurrentMap();
}


// constant functions
// checks if the routes website is of relevance or not.
async function checkForRelevantRoute(neuronUrl, previousNeuronIdx) {

    // putting this check so that the analysis happens 2 levels deep into the map
    if (previousNeuronIdx > 1) {

        let siteEndpoint = neuronUrl.indexOf(".");
        let croppedUrl = "";
        let url = neuronUrl;
        let slashNo = 0;


        // if ((neuronUrl.substring((neuronUrl.indexOf(".")) + 1, neuronUrl.length - 1)).indexOf(".")) {
        //     logConsoleInto(5, neuronUrl);
        // }


        for (let i = siteEndpoint + 1; i < url.length; i++) {
            if (url[i] === ".") {

                // cropping the everything of the website before .com or .in, basically the domain name.
                for (let j = 0; j < i; j++) {
                    croppedUrl = croppedUrl + url[j];
                }

                // checking for number of slashes to see if its routing to another website, then its not just the website but a route inside it.
                for (let k = i; k < url.length; k++) {
                    if (url[k] === "/") {
                        ++slashNo;
                    }
                }
            }
        }


        // it checks if the route of the same website that the user is visiting 
        if (currentMap[previousNeuronIdx].url.indexOf(croppedUrl) > 0 || slashNo >= 2) {
            return false;
        } else {
            return true;
        }
    }

}

// this extracts the website removing the deep routes into any website
function getPrimaryWebUrl(webUrl) {

    let urlList = webUrl.split(".");

    return (urlList[0] + urlList[1]);

}

async function loadCurrentMapIntoSession() {

    // writing the new code to put current map into session

    let currentMapCopy = [];
    let mapObjCopy = Object.assign({}, currentMapObj);

    currentMap.forEach((map, index) => {
        // if (index < indexInPresentMap) {
        currentMapCopy.push(map);
        // }
    });

    if (currentMapCopy.length > 0) {
        mapObjCopy.mapArr = currentMapCopy;
        mapObjCopy.mapEndTimeStamp = "";
        mapObjCopy.totalNeurons = currentMapCopy.length;
        mapObjCopy["firstNeuronUrl"] = mapObjCopy.mapArr[0].url;
    }

    currentSessionMaps.forEach((map, index) => {
        if (map.id === mapObjCopy.id) {
            // this means that the current map has a copy in the session maps
            removeMapFromCurrentSession(map.id);
        }

    });

    // currentSessionMaps.push(Object.assign({}, currentMapObj));
    if (mapObjCopy.mapArr.length > 0) {
        addintoCurrentSessionMap(mapObjCopy);
    }

    logConsoleInto(1, "just before returning");

    return;
}


// makes the map as current and this will continue as the active mind map
function activateAnotherMap(mapId) {
    // degraded logic. Getting map index from session maps
    currentSessionMaps.forEach((mapObj) => {
        if (mapObj.id === mapId) {
            // setting all variables as per the loaded map
            currentMapObj = mapObj;
            currentMap = mapObj.mapArr;
            globalMapIdx = mapObj.mapArr[mapObj.mapArr.length - 1].mapIndex;

        }
    });

    logConsoleInto(1, "the current map right now is");
    logConsoleInto(2, currentMapObj);
}

function showCurrentSessionMaps(showActiveMapAlso) {

    if (showActiveMapAlso) {
        logConsoleInto(1, "active map is");
        logConsoleInto(2, currentMap);
    }

    logConsoleInto(1, "current session maps");
    logConsoleInto(2, currentSessionMaps);

}

function showRedundantMaps() {
    logConsoleInto(1, "redundant maps are");
    logConsoleInto(2, redundantMapsFromSession);
}


function takeScreenShot() {
    chrome.tabs.captureVisibleTab(null, {}, function(image) {
        console.log(image);
    });
}

function removeMapFromCurrentSession(mapId) {
    currentSessionMaps.forEach((map, index) => {
        if (map.id === mapId) {
            currentSessionMaps.splice(index, 1);
        }
    });
}

function addintoCurrentSessionMap(mapObj) {
    // adding the map into google cloud
    // if (mapObj.mapArr[0].tabId === undefined) {
    //     mapObj.mapArr = mapObj.mapArr.splice(0, 1);
    //     addDataIntoFirebase("map", mapObj);
    // } else {
    //     addDataIntoFirebase("map", mapObj);
    // }

    addDataIntoFirebase("map", mapObj);

    currentSessionMaps.push(Object.assign({}, mapObj));
}

// this wil check for the deletion of all the neurons on the map and finally moves the map into redundant map
function checkForRedundantTransfer() {

    let mapId = 0;
    let mapIndex = 0;

    currentSessionMaps.forEach((map, mapIdx) => {
        mapId = map.id;
        mapIndex = mapIdx;
        let deathCount = -1;
        map.mapArr.forEach(neuron => {
            if (neuron.life[neuron.life.length - 1]["birth"]) {
                ++deathCount
            }
        });

        if (deathCount === -1) {
            logConsoleInto(1, `now the map with id ${mapId} will be moved into redundant. It is so sad that it is dead`);
            transferMapToRedundant(mapId, mapIndex);
        }
    });
}

function transferMapToRedundant(mapId, mapIndex) {
    redundantMapsFromSession.push(currentSessionMaps[mapIndex]);
    removeMapFromCurrentSession(mapId);
    // currentSessionMaps.splice(mapIndex, 1);
}

// this function will check to which mindmap the tab belongs - active or any one from the current session.
// update for 28th Nov. This function needs to be tested
function searchInAllMaps(mode, value) {
    // this object has the map id, the place, the searched neuron index and the map index in case the map is in session maps
    // and it returns all this data for the tab or the neuron that is searched.
    let mapIdObj = {
        id: 0,
        place: "",
        neuronIndex: 0,
        sessionMapIndex: 0
    };

    let found = false;

    // through tab and use tabid as value
    if (mode === "tab") {

        // let found = false;

        // looking into the active map neurons
        currentMap.forEach((neuron, index) => {
            if (neuron.tabId === value || neuron.fromTab === value) {
                // the tab belongs to the active map
                found = true;
                mapIdObj.id = currentMapObj.id;
                mapIdObj.place = "current";
                mapIdObj.neuronIndex = index;
                logConsoleInto(1, `belongs to the active map and id is = ${currentMapObj.id}`);
            }
        });

        // now searching in all the session maps

        if (!found) {
            currentSessionMaps.forEach((map, index) => {
                map.mapArr.forEach((neuron, neuroIdx) => {
                    if (neuron.tabId === value || neuron.fromTab === value) {
                        logConsoleInto(1, `belongs to the session map with id = ${map.id}`);
                        found = true;
                        mapIdObj.id = map.id;
                        mapIdObj.place = "session";
                        mapIdObj.neuronIndex = neuroIdx;
                        mapIdObj.sessionMapIndex = index;
                        // now the ongoing map will take a back seat and this map will become the active map
                    }
                });
            });
        }

        // the selected tab is not part of any map
        if (!found) {
            logConsoleInto(1, "does not match with any maps");
            return false;
        } else {
            return mapIdObj;
        }

    } else if (mode === "neuron") {
        // use neuron and use neuron as value

        // let found = false;

        // looking into the active map neurons
        currentMap.forEach((neuron, index) => {
            if (neuron.url === value) {
                // the tab belongs to the active map
                found = true;
                mapIdObj.id = currentMapObj.id;
                mapIdObj.place = "current";
                mapIdObj.neuronIndex = index;
                logConsoleInto(1, `belongs to the active map and the id is = ${currentMapObj.id}`);
            }
        });

        // searching in all the session Maps

        currentSessionMaps.forEach((map, index) => {
            map.mapArr.forEach((neuron, neuroIdx) => {
                if (neuron.url === value) {
                    logConsoleInto(1, `belongs to the map with id = ${map.id}`);
                    found = true;
                    mapIdObj.id = mapa.id;
                    mapIdObj.place = "session";
                    mapIdObj.neuronIndex = neuroIdx;
                    mapIdObj.sessionMapIndex = index;
                    // now the ongoing map will take a back seat and this map will become the active map
                }
            });
        });

        if (!found) {
            logConsoleInto(1, "current tab not part of any map");
            return false;
        } else {
            return mapIdObj;
        }

    }

}

// this method looks into every tab and checks if it belongs to any Map.
function mapTabsWithMaps() {

}

async function onWindowClosed(val) {
    // once a speific window is closed, that windowMap object will get saved into local storage
    if (currentWindowMaps.windowId === val) {
        loadCurrentMapIntoSession();
        currentWindowMaps.sessionMaps = Object.assign({}, currentSessionMaps);
        currentWindowMaps.activity.push({ death: new Date() });
        if (currentWindowMaps.sessionMaps.length > 1) {
            addDataIntoFirebase("sessions", currentWindowMaps);
        }
    }

}

// I am going to get today, yesterday and last week and more from here. just a casual function
function getPracticalDateTime(dateObj) {

    let incomingDate = new Date(dateObj);

    let incomingDateArr = [
        incomingDate.getDate(),
        Number(incomingDate.getMonth()) + 1,
        incomingDate.getFullYear()
    ];

    let todayDate = new Date();

    todayDateArr = [
        todayDate.getDate(),
        Number(todayDate.getMonth()) + 1,
        todayDate.getFullYear()
    ];

    // for this month
    if (incomingDateArr[1] === todayDateArr[1] && incomingDateArr[2] === todayDateArr[2]) {

        // for today
        if (incomingDateArr[0] === todayDateArr[0]) {
            return ("today oan " + incomingDate.getHours() + ":" + incomingDate.getMinutes());
        } else {

            let dayGap = Number(todayDateArr[0]) - Number(incomingDateArr[0]);

            // for yesterday and day before yesterday
            switch (Number(todayDateArr[0]) - Number(incomingDateArr[0])) {

                case 1:
                    return ("yesterday on " + incomingDate.getHours() + ":" + incomingDate.getMinutes());


                case 2:
                    return ("day before yesterday on " + incomingDate.getHours() + ":" + incomingDate.getMinutes());

                    // this can also deal with the ongoing week and the day name. More relevant and relatable

                default:
                    return ("sometime in the last week or earlier in the month");

            }

        }

    }

}

async function getObjectwithAllTabs() {

    let tabRecord = {};
    let generalIndex = 0;

    chrome.tabs.query({},
        function(tabs) {
            tabs.forEach(tab => {
                tabRecord[generalIndex++] = tab.url;
            });
            // logConsoleInto(4, "got all the tabs");
            return tabRecord;
        }
    );

}

function addIntoBlockUrls(url) {
    blocklUrlList.push(url);
}

function logConsoleInto(area, val) {

    switch (area) {
        case 1:
            // for all strings 
            console.log(val);
            break;

        case 2:
            // for objects
            console.log(val);
            break;

        case 3:
            // for experimentation
            console.log(val);
            break;

        case 4:
            console.log(val);
            break;

        case 5:
            console.log(val);
            break;
    }

}


// $BACKGROUND ------------------------  BACKGROUND FUNCTIONS END ----------------------------



// -------------------------- MESSAGE PASSING METHODS STARTS ------------------ 

// listening to messages
chrome.runtime.onMessage.addListener(
    (request, sender, sendResponse) => {
        if (request && request.title) {
            processMessage(request);
        }
    });

function sendMsg(msg) {
    chrome.runtime.sendMessage(msg);
}

async function processMessage(message) {
    switch (message.title) {

        case "getData":

            await chrome.storage.local.get(null, (items) => {
                if (items && (items["lastMap"] || items["session"])) {
                    return items;
                } else {
                    return false;
                }
            });

            break;

        case "clearData":
            removeFromStorage(null);
            break;

        case "storeCurrentMap":
            saveInLocalStorage("session", currentSessionMaps);
            break;

        case "blockUrl":
            addIntoBlockUrls(message.value);

    }
}

// $MESSAGE ----------------------------- MESSAGE PASSING METHODS END ------------------------------



// ------------ STORAGE & RECURSIVE STORAGE METHODS ----------------------

function saveInLocalStorage(area, data) {

    let key = "";
    let storageObj = {};

    switch (area) {

        case "session":
            key = "session";
            storageObj = {
                value: data
            };
            break;

        case "current":
            key = "lastMap";
            storageObj = {
                value: data
            }
            break;

    }

    chrome.storage.local.set({
        [key]: storageObj
    }, () => {
        return true;
    });
}

async function getFromLocalStorage(key) {

    chrome.storage.local.get([key], (res) => {
        if (res) {
            dataFromStorage = res;
            return true;
        } else {
            dataFromStorage = {
                data: 'there is nothing but hey, the logic is working as expected'
            };
            return false;
        }
    });

}

async function getAllDataFromStorage() {
    await chrome.storage.local.get(null, (items) => {
        if (items) {
            return items;
        } else {
            return false;
        }
    });
}

function removeFromStorage(key) {

    if (key) {
        // clear specific keys from the storage
        chrome.storageArea.remove(key, () => {});
    } else {
        // clear everything from the chrome storage
        chrome.storage.local.clear(() => {
            logConsoleInto(2, "everything from the local has been cleared");
        });
    }
}