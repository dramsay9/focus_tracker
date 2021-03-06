fs = require('fs');


function load_json_date(file, startDate, endDate){
    //we can assume they're in reverse chronological order
    var data = JSON.parse(fs.readFileSync(file));

    var i = 0;
    var currDate = Date.parse(data[0].timestamp);

    var results = [];

    while (currDate >= startDate && i < data.length){

        if (currDate <= endDate){ results.push(data[i]); }

        i+=1;
        currDate = Date.parse(data[i].timestamp);
    }

    return results;
}

function load_json_strings(file, startDate, endDate){
    //we can assume they're in reverse chronological order
    var data = JSON.parse(fs.readFileSync(file));

    startDate = startDate.getTime();
    endDate = endDate.getTime();

    var i = 0;
    var currDate = data[0].startTime;

    var results = [];

    while (currDate >= startDate && i < data.length){

        if (currDate <= endDate){ results.push(data[i]); }

        i+=1;
        currDate = data[i].startTime;
    }

    return results;
}


function parse_idles(startDate=null, endDate=null){

    var data = load_json_date('./idles.json', startDate, endDate);
    var results = {};

    results['lastIdleState'] = data[0].idleState;
    results['idleActiveSwitches'] = data.length - 1;

    var timeIdle = 0;
    var timeActive = 0;
    var numSessions = 0;
    var longestSession = 0;
    var longestIdle = 0;

    for (var i=data.length - 1; i > 0; i--){

        var sesslength = Date.parse(data[i-1].timestamp) - Date.parse(data[i].timestamp);

        if (data[i].idleState == 'active'){
            if (sesslength > longestSession) { longestSession = sesslength; }
            timeActive += sesslength;
            numSessions += 1;
        } else {
            if (sesslength > longestIdle) { longestIdle = sesslength; }
            timeIdle += sesslength;
        }
    }

    var toMin = 60*1000;

    results['ActiveMin'] = timeActive / toMin;
    results['IdleMin'] = timeIdle / toMin;
    results['numSessions'] = numSessions;
    results['avgDurationSessionMin'] = timeActive / (toMin * numSessions);
    results['longestSessionMin'] = longestSession / toMin;
    results['longestIdleMin'] = longestIdle / toMin;

    return results;

}

function get_domain(url){
    var matches = url.match(/^https?\:\/\/(?:www\.)?([^\/?#]+)(?:[\/?#]|$)/i);
    var domain = matches && matches[1];
    if (!domain) { domain = url.split('/')[2]; }
    return domain;

}

function parse_focuses(startDate=null, endDate=null){
    var data = load_json_strings('./focuses.json', startDate, endDate);

    var results = {};
    var domains = {};
    var queries = [];

    var uris = [];

    var tabSwitches = 0;

    var totalTime = 0

    var bad_domains = ['netflix','facebook','youtube','reddit'];
    results['secondsTimewasters'] = 0;
    results['visitsTimewasters'] = 0;

    var email_domains = ['webmail','exchange.mit','mail.google','gmail','yahoo'];
    results['secondsEmail'] = 0;
    results['visitsEmail'] = 0;

    var good_domains = ['stack','mit','medium','git'];
    results['secondsGoodSites'] = 0;
    results['visitsGoodSites'] = 0;

    for (var i=0; i<data.length; i++) {

        //duration on site
        var site_duration = (data[i].endTime - data[i].startTime) / (1000);
        totalTime += site_duration;

        //tab switch?
        if (i>0 && (data[i-1].tabId != data[i].tabId)) { tabSwitches += 1; }

        //count unique uris
        var uri = data[i].url;
        uris.push(uri);

        //get domain
        var domain = get_domain(uri);
        if (!domains[domain]) { domains[domain] = site_duration; }
        else { domains[domain] += site_duration; }

        //count/track specific domains
        for (var j in bad_domains){
           if (domain.includes(bad_domains[j])) {

               results['secondsTimewasters'] += site_duration;

               if (i>0 && (domain != get_domain(data[i-1].url))) {
                    results['visitsTimewasters'] += 1;
               }
           }
        }
        for (var j in email_domains){
           if (domain.includes(email_domains[j])) {

               results['secondsEmail'] += site_duration;

               if (i>0 && (domain != get_domain(data[i-1].url))) {
                    results['visitsEmail'] += 1;
               }
           }
        }
        for (var j in good_domains){
           if (domain.includes(good_domains[j])) {

               results['secondsGoodSites'] += site_duration;

               if (i>0 && (domain != get_domain(data[i-1].url))) {
                    results['visitsGoodSites'] += 1;
               }
           }
        }

        //pull out google queries
        if (uri.includes('google.com/search?')) {

            var query_match = uri.match(/[\?\&]q\=([^&]+)\&/i);
            var query = query_match && query_match[1];
            query = query.replace(/\+/g, ' '); //replace + with space

            // for now we'll just keep the actual query, not the pre-empted
            //var orig_query_match = uri.match(/[\?\&]oq\=([^&]+)\&/i);
            //var orig_query = orig_query_match && orig_query_match[1];
            //orig_query = orig_query.replace(/\+/g, ' ');

            queries.push(query);
        }

    }

    var uri_set = new Set(uris);

    results['numFocuses'] = data.length;
    results['numURIs'] = uri_set.size;
    results['numDomains'] = Object.keys(domains).length;
    results['tabSwitches'] = tabSwitches;
    results['avgSecOnURI'] = totalTime / results['numURIs'];
    results['avgSecOnDomain'] = totalTime / results['numDomains'];
    results['queries'] = queries;
    results['domains'] = domains;

    return results;
}


function parse_windows(startDate=null, endDate=null){

    var data = load_json_date('./windows0.json', startDate, endDate);
    var currentWindows = data[0].info;

    var results = {};

    results['numWindowsMinimized'] = 0;
    results['numTabsMinimized'] = 0;
    results['numTabsActive'] = 0;
    results['tabsActive'] = [];
    results['tabsMinimized'] = [];
    results['domainsActive'] = [];
    results['domainsMinimized'] = [];

    for (var i in currentWindows){
        if (currentWindows[i].state == 'minimized'){
            results['numWindowsMinimized'] += 1;
            results['numTabsMinimized'] += currentWindows[i].tabs.length;

            for (j in currentWindows[i].tabs){
                results['tabsMinimized'].push(currentWindows[i].tabs[j].title);
                results['domainsMinimized'].push(get_domain(currentWindows[i].tabs[j].url));
            }
        } else{
            results['numTabsActive'] += currentWindows[i].tabs.length;

            for (j in currentWindows[i].tabs){
                results['tabsActive'].push(currentWindows[i].tabs[j].title);
                results['domainsActive'].push(get_domain(currentWindows[i].tabs[j].url));
            }
        }
    }

    results['numWindowsActive'] = currentWindows.length - results['numWindowsMinimized'];

    results['domainsActive'] = [...new Set(results['domainsActive'])];
    results['domainsMinimized'] = [...new Set(results['domainsMinimized'])];

    return results;

}

function parse_displays(startDate=null, endDate=null){

    var data = load_json_date('./displays.json', startDate, endDate);
    var results = {};

    results['lastNumScreens'] = data[0].info.length;
    results['screenSwitches'] = data.length;

    return results;
}


//--helpers to get current to back in time by some num of days or minutes

function get_day_history(numdays=7){
    //return dates [now-numdays, now]
    var today = new Date();

    var prev = new Date();
    prev.setDate(prev.getDate()-numdays);

    return [prev, today];
}

function get_min_history(nummin=120){
    //return dates [now-nummin, now]
    var today = new Date();

    var prev = new Date();
    prev.setMinutes(prev.getMinutes()-nummin);

    return [prev, today];
}


//--get a date range, and check out our results of parsing each of these

dates = get_day_history(1);
console.log(dates);

console.log(parse_idles(dates[0], dates[1]));
console.log(parse_focuses(dates[0], dates[1]));
console.log(parse_windows(dates[0], dates[1]));
console.log(parse_displays(dates[0], dates[1]));
