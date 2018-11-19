
aasaIsValid = function(results) {
    return results != undefined && results.jsonValid && (results.bundleIdentifierFound === true || results.bundleIdentifierFound === undefined);
};

identifiersDoNotMatch = function(results) {
    return results != undefined && results.bundleIdentifierFound === false;
}

jsonInvalid = function(results) {
    return results != undefined && results.jsonValid === false;
};

isEmpty = function(obj) {
    return obj === undefined || Object.keys(obj).length == 0;
};

function _parse(domainName, results) {
    let parseResult = { success : {} , error : {}};
    let domainResults = results.domains[domainName];
    if (aasaIsValid(domainResults) && isEmpty(domainResults.errors)) {
        parseResult.success = true;
        return parseResult;
    }
    if (identifiersDoNotMatch(domainResults)) {
        parseResult.success = false;
        parseResult.error.message = "This domain has a valid AASA, but does not contain provided Bundle / Apple App Prefix Identifiers. Bundle information can be found in the General tab for your build target in Xcode. App Prefix information can be found on your Apple Developer Account on the App IDs page.";
        return parseResult;
    }

    if (jsonInvalid(domainResults)) {
        parseResult.success = false;
        parseResult.error.message = "This domain's AASA was pulled, but the JSON format seems Invalid"
        return parseResult;
    }

    if (!isEmpty(domainResults.errors)) {
        parseResult.success = false;
        if (domainResults.errors.errorOutOfScope) {
            parseResult.error.message = "This domain has some validation issues. A request to this domain failed." 
        }
        if (domainResults.errors.badDns) {
            parseResult.error.badDns = "Your domain does not have valid DNS"
        }
        if (domainResults.errors.httpsFailure) { 
            parseResult.error.httpsFailure = "Your file must be served over HTTPS. It is recommended that you check with your network provider to support SSL/TLS"
        }
        if (domainResults.errors.serverError) {
            parseResult.error.serverError = "Your server returned an error status code (>= 400). This includes client side and server side errors"
        }
        if (domainResults.errors.badContentType) {
            parseResult.error.badContentType = "Your file's 'content-type' header was not found or was not recognized."
        } 
        if (domainResults.errors.invalidJson) {
            parseResult.error.invalidJson = "Your file should contain valid JSON (using simple JSON.parse)."
        }
        return parseResult;
    }
}

module.exports.parse = _parse;
