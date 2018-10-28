var B = require('bluebird');
var superagent = require('superagent');
var childProcess = require('child_process');
var fs = require('fs');
var path = require('path');

// Override the default behavior of superagent, which encodes to UTF-8.
var _parse = function(res, done) {
    res.text = '';
    res.setEncoding('binary');
    res.on('data', function(chunk) { res.text += chunk; });
    res.on('end', done);
};

function _verifyJsonFormat(aasa) {
    var applinks = aasa.applinks;
    if (!applinks) {
        return false;
    }

    var details = applinks.details;
    if (!details) {
        return false;
    }

    // Domains are an array: [ { appID: '01234567890.com.foo.FooApp', paths: [ '*' ] } ]
    if (details instanceof Array) {
        for (var i = 0; i < details.length; i++) {
            var domain = details[i];
            if (!(typeof domain.appID === 'string' && domain.paths instanceof Array)) {
                return false;
            }
        }
    }
    // Domains are an object: { '01234567890.com.foo.FooApp': { paths: [ '*' ] } }
    else {
        for (var domain in details) {
            if (!(details[domain].paths instanceof Array)) {
                return false;
            }
        }
    }

    return true;
}

function _verifyBundleIdentifierIsPresent(aasa, bundleIdentifier, teamIdentifier) {
    var regexString = bundleIdentifier.replace(/\./g, '\\.') + '$';
    if (teamIdentifier) {
        regexString = teamIdentifier + '\\.' + regexString;
    }

    var identifierRegex = new RegExp(regexString);

    var details = aasa.applinks.details;

    // Domains are an array: [ { appID: '01234567890.com.foo.FooApp', paths: [ '*' ] } ]
    if (details instanceof Array) {
        for (var i = 0; i < details.length; i++) {
            var domain = details[i];
            if (identifierRegex.test(domain.appID) && domain.paths instanceof Array) {
                return true;
            }
        }
    }
    // Domains are an object: { '01234567890.com.foo.FooApp': { paths: [ '*' ] } }
    else {
        for (var domain in details) {
            if (identifierRegex.test(domain) && details[domain].paths instanceof Array) {
                return true;
            }
        }
    }

    return false;
}

function _evaluateAASA(content, bundleIdentifier, teamIdentifier, encrypted) {
    return new B(function(resolve, reject) {
        try {
          
            var domainAASAValue = JSON.parse(content);

            // Make sure format is good.
            var jsonValidationResult = _verifyJsonFormat(domainAASAValue);


            // Only check bundle identifier if json is good and a bundle identifier to test against is present
            var bundleIdentifierResult;
            if (jsonValidationResult && bundleIdentifier) {
                bundleIdentifierResult =_verifyBundleIdentifierIsPresent(domainAASAValue, bundleIdentifier, teamIdentifier);
            }

            resolve({ encrypted: encrypted, aasa: domainAASAValue, jsonValid: jsonValidationResult, bundleIdentifierFound: bundleIdentifierResult });
        }
        catch (e) {
            reject(e);
        }
    });
}

function _checkDomain(fileUrl, bundleIdentifier, teamIdentifier) {
   
    return new B(function(resolve, reject) {
        var errorObj = { };

        superagent
            .get(fileUrl)
            .timeout(3000)
            .buffer()
            .parse(_parse)
            .end(function(err, res) {
                if (err && !res) {
                    // Unable to resolve DNS name
                    if (err.code == 'ENOTFOUND') {
                        errorObj.badDns = true;
                    }
                    // Doesn't support HTTPS
                    else if (err.code == 'ECONNREFUSED' || /Hostname\/IP doesn't match certificate's altnames/.test(err.message)) {
                        errorObj.badDns = false;
                        errorObj.httpsFailure = true;
                    }
                    else {
                        errorObj.errorOutOfScope = true;
                    }
                  
                    reject(errorObj);
                }
                else {
                    
                   
                    errorObj.badDns = false;
                    errorObj.httpsFailure = false;

                    var isValidMimeType = res.headers['content-type'] !== undefined && 
                            (res.headers['content-type'].indexOf('application/pkcs7-mime') > -1 || 
                            res.headers['content-type'].indexOf('application/octet-stream') > -1 ||
                            res.headers['content-type'].indexOf('application/json') > -1 ||
                            res.headers['content-type'].indexOf('text/json') > -1 ||
                            res.headers['content-type'].indexOf('text/plain') > -1 );
                    
                    // Bad server response
                    if (res.status >= 400) {
                        errorObj.serverError = true;
                        // Check here for alternate URL
                        reject(errorObj);
                    }

                    else if (!isValidMimeType) {
                        errorObj.serverError = false;
                        errorObj.badContentType = true;
                        reject(errorObj);
                    }
                    else {
                        errorObj.serverError = false;
                        errorObj.badContentType = false;
                       
                        _evaluateAASA(res.text, bundleIdentifier, teamIdentifier, false)
                                .then(resolve) // Not encrypted, send it back
                                .catch(function() { // Nope, encrypted. Go through the rest of the process
                                    return _parseEncryptedContentForJSON(res.text, bundleIdentifier, teamIdentifier)
                                })
                                .then(resolve)
                                .catch(function(err) {
                                    errorObj.invalidJson = err.invalidJson;
                                    reject(errorObj);
                                });
                       
                      
                    }
                }
            });
    });
}

function _performRegexSearch(reg_ex_pattern, content_to_search){
    var re = reg_ex_pattern; 
    var str = content_to_search;
    var regex_result;
    if ((regex_result = re.exec(str)) !== null) {
        if (regex_result.index === re.lastIndex) {
            re.lastIndex++;
        }
    }
    return regex_result; 
}

function _parseEncryptedContentForJSON(content,bundleIdentifier,teamIdentifier){
return new B(function(resolve,reject){
    try {
            var applinks = _performRegexSearch(/{{1}\s*"{1}applinks"{1}/, content);
            if(applinks && applinks.index){
                content = content.substr(applinks.index, content.length-1);
            }

            var webcredentials = _performRegexSearch(/{{1}\s*"{1}webcredentials"{1}/, content);
            if(webcredentials && webcredentials.index){
                content = content.substr(webcredentials.index, content.length-1);
            }

            var activityContinuation = _performRegexSearch(/{{1}\s*"{1}activitycontinuation"{1}/, content);
            if(activityContinuation && activityContinuation.index){
                content = content.substr(activityContinuation.index, content.length-1);
            }

            if(!applinks && !webcredentials && !activityContinuation){
                reject({ invalidJson: true });
                return;
            }
            
            var open_braces = 0, close_braces = 0;

            for(var i = 0; i < content.length; i++){

                if(content.charAt(i) == '{'){
                    open_braces = open_braces + 1;
                }

                if(content.charAt(i) == '}'){
                    close_braces = close_braces + 1;
                }

                if(open_braces == close_braces){
                    var aasa_string = content.substr(0, i+1);
                    return _evaluateAASA(aasa_string, bundleIdentifier, teamIdentifier, true)
                        .then(resolve)
                        .catch(function() {
                            reject({ invalidJson: true });
                            return;
                        });
                }
            }

        }catch(err){
            reject({ invalidJson: true });
            return;
        }
    });
}


module.exports = _checkDomain;