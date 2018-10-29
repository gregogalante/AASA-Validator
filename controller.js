var checkDomain = require('./validator')
function getResult (domain, bundleIdentifier, teamIdentifier) {
    var respObj = { domains: { } };

    var cleanedDomain = domain.replace(/https?:\/\//, '');
    cleanedDomain = cleanedDomain.replace(/\/.*/, '');

    var fileUrl = 'https://' + cleanedDomain + '/apple-app-site-association';
    return checkDomain(fileUrl, bundleIdentifier, teamIdentifier)
        .then(function(results) {
            respObj.domains[domain] = results;
            return respObj;
        })
        .catch(function(errorObj) {
            
            //check if AASA file exists in the root domain 
            var noFile = false;
            try {
                fs.accessSync(fileUrl);
            } catch (e) {
                console.log('file does not exist in the root. checking .well-known')
                noFile = true;
            }

            if(errorObj.serverError || errorObj.errorOutOfScope || errorObj.badDns || errorObj.httpsFailure || noFile){
                    fileUrl = 'https://' + cleanedDomain + '/.well-known/apple-app-site-association';
                    return checkDomain(fileUrl,bundleIdentifier,teamIdentifier)
                        .then(function(results){
                            respObj.domains[domain] = results;
                            return respObj;
                        }).catch(function(errorObj){

                            respObj.domains[domain] = { errors: errorObj };
                            return respObj;
                        })
            }
            respObj.domains[domain] = { errors: errorObj };
            return respObj;
        });
}

function parseResult() {

}

function main() {
     getResult('smartconnectdev.mckinsey.com', '', '')
                .then(function(success) {
                    console.log(success.domains['smartconnectdev.mckinsey.com'].aasa)
                    console.log(success.domains['smartconnectdev.mckinsey.com'].errors)
                }).catch(function(err) {
                    
                })
}

main()