var validator = require('./validator')
var parser = require('./parser')


function getResult(domain, bundleIdentifier, teamIdentifier) {
    var respObj = { domains: {} };

    var cleanedDomain = domain.replace(/https?:\/\//, '');
    cleanedDomain = cleanedDomain.replace(/\/.*/, '');

    var fileUrl = 'https://' + cleanedDomain + '/apple-app-site-association';
    return validator.validate(fileUrl, bundleIdentifier, teamIdentifier)
        .then(function (results) {
            respObj.domains[domain] = results;
            return respObj;
        })
        .catch(function (errorObj) {

            //check if AASA file exists in the root domain 
            var noFile = false;
            try {
                fs.accessSync(fileUrl);
            } catch (e) {
                console.log('file does not exist in the root. checking .well-known')
                noFile = true;
            }

            if (errorObj.serverError || errorObj.errorOutOfScope || errorObj.badDns || errorObj.httpsFailure || noFile) {
                fileUrl = 'https://' + cleanedDomain + '/.well-known/apple-app-site-association';
                return validator.validate(fileUrl, bundleIdentifier, teamIdentifier)
                    .then(function (results) {
                        respObj.domains[domain] = results;
                        return respObj;
                    }).catch(function (errorObj) {

                        respObj.domains[domain] = { errors: errorObj };
                        return respObj;
                    })
            }
            respObj.domains[domain] = { errors: errorObj };
            return respObj;
        });
}

function validateAASAFileFromDomain(domain, bundleIdentifier, teamIdentifier) {
    return getResult(domain, bundleIdentifier, teamIdentifier)
        .then(function (success) {
            var parseResult = parser.parse(Object.keys(success.domains)[0], success);
            return parseResult;
        }).catch(function (err) {
            return err;
        })
}

function main() {
    validateAASAFileFromDomain('facebook.com', '', '')
        .then(function (result) {
            console.log(result);
        })
}
main()