// Example express application adding the parse-server module to expose Parse
// compatible API routes.

const
  bodyParser = require('body-parser'),
  config = require('config'),
  crypto = require('crypto'),
  express = require('express'),
  https = require('https'),
  ParseServer = require('parse-server').ParseServer,
  path = require('path'),
  ParseDashboard = require('parse-dashboard'),
  request = require('request');

var databaseUri = process.env.DATABASE_URI || process.env.MONGODB_URI;

if (!databaseUri) {
  console.log('DATABASE_URI not specified, falling back to localhost.');
}

var api = new ParseServer({
  databaseURI: databaseUri || 'mongodb://localhost:27017/dev',
  cloud: process.env.CLOUD_CODE_MAIN || __dirname + '/cloud/main.js',
  appId: process.env.APP_ID || 'myAppId',
  restAPIKey: process.env.REST_KEY,
  masterKey: process.env.MASTER_KEY || '', //Add your master key here. Keep it secret!
  serverURL: process.env.SERVER_URL || 'http://localhost:1337/parse', // Don't forget to change to https if needed
  liveQuery: {
    classNames: ["Posts", "Comments"] // List of classes to support for query subscriptions
  }
});

var allowInsecureHTTP = true;
var dashboard = new ParseDashboard({
  "apps": [{
    "serverURL": process.env.SERVER_URL,
    "appId": process.env.APP_ID,
    "masterKey": process.env.MASTER_KEY,
    "appName": process.env.APP_NAME
  }],
  "users": [{
    "user": "admin",
    "pass": "pass"
  }]
}, allowInsecureHTTP);

// Client-keys like the javascript key or the .NET key are not necessary with parse-server
// If you wish you require them, you can set them as options in the initialization above:
// javascriptKey, restAPIKey, dotNetKey, clientKey

var app = express();
app.use(bodyParser.json({
  verify: verifyRequestSignature
}));

app.use(express.static('public'));


const APP_SECRET = (process.env.FB_APP_SECRET) ?
  process.env.FB_APP_SECRET :
  config.get('appSecret');

const VALIDATION_TOKEN = (process.env.FB_VALIDATION_TOKEN) ?
  (process.env.FB_VALIDATION_TOKEN) :
  config.get('validationToken');
if (!(VALIDATION_TOKEN && APP_SECRET)) {
  console.error("Missing config values");
  process.exit(1);
}

/*
 * Use your own validation token. Check that the token used in the Webhook
 * setup is the same token used here.
 *
 */
app.get('/webhook', function(req, res) {
  if (req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === VALIDATION_TOKEN) {
    console.log("Validating webhook");
    res.status(200).send(req.query['hub.challenge']);
  } else {
    console.error("Failed validation. Make sure the validation tokens match.");
    res.sendStatus(403);
  }
});
app.post('/redirect', function(req, res) {
  console.log(JSON.stringify(req));
});

app.post('/webhook', function(req, res) {
  var data = req.body;

  // Make sure this is a page subscription
  if (data.object == 'page') {
    // Iterate over each entry
    // There may be multiple if batched
    console.log("data: ", JSON.stringify(data));

    data.entry.forEach(function(pageEntry) {
      var pageId = pageEntry.id;
      var timeOfEvent = pageEntry.time;

      if (pageEntry.changes) {
        console.log("changes: ", JSON.stringify(pageEntry.changes));

        pageEntry.changes.forEach(function(changesEvent) {
          if (changesEvent.value.item == "comment" && pageId != changesEvent.value.sender_id
          && changesEvent.value.verb == "add") {
            var commentMsg = "";
            if (changesEvent.value.message) {
              console.log(changesEvent.value.sender_name + "--> comment : " + changesEvent.value.message);
              commentMsg = changesEvent.value.message;
            }else {
              console.log(changesEvent.value.sender_name + "--> sticker ");
            }

            callParseServerCloudCode("getPageAccessTokenFromPageId", '{"pageId":"' + pageId + '"}', function(response) {
              if (response) {
                var pageAccessToken = response;
                console.log("pageAccessToken : " + pageAccessToken);
                getPostMessage(changesEvent.value.post_id, pageAccessToken, function(response) {
                  if (response) {
                    checkTagInComment(changesEvent.value.comment_id, pageAccessToken, function(bool) {
                      var isHasTag = false;
                      if (bool) {
                        isHasTag = true;
                      }
                      var msg = "";
                      if (response.message) {
                        msg = response.message;
                        msg = msg.replace(/(?:\r\n|\r|\n)/g, '');
                        msg = msg.replace(/:/g, '');
                        msg = msg.replace(/"/g, '');
                        msg = msg.replace(/'/g, '');
                        msg = msg.replace(/}/g, '');
                        msg = msg.replace(/{/g, '');
                      }
                      if (commentMsg != "") {
                        commentMsg = commentMsg.replace(/(?:\r\n|\r|\n)/g, ' ');
                        commentMsg = commentMsg.replace(/:/g, '');
                        commentMsg = commentMsg.replace(/"/g, '');
                        commentMsg = commentMsg.replace(/'/g, '');
                        commentMsg = commentMsg.replace(/}/g, '');
                        commentMsg = commentMsg.replace(/{/g, '');
                      }

                      var req = '{"comment":"' + commentMsg + '","post":"' + msg + '","pageId":"' + pageId + '","isHasTag":' + isHasTag + '}';
                      callParseServerCloudCode("findMatchReply", req, function(res) {
                        if (res) {
                          if (res.reply) {
                            var replyMsg = res.reply.replace(/\\n/g, '\n');
                            callCommentsReplyAPI(changesEvent.value.comment_id, pageAccessToken, replyMsg);
                            callParseServerCloudCode("incresePageReplyCount", '{"pageId":"' + pageId + '"}', function(res) {

                            });
                          }
                          if (res.inbox) {
                            var inbox = res.inbox.replace(/\\n/g, '\n');
                            if(res.isShowPostLink && (changesEvent.value.post.permalink_url != null)){
                              inbox = "ตามที่ลูกค้า Comment ในโพส" + changesEvent.value.post.permalink_url + "\n\n" + inbox;
                              //callPrivateReplyAPI(changesEvent.value.comment_id, pageAccessToken, "ตามที่ลูกค้า Comment ในโพส");
                              //callPrivateReplyAPI(changesEvent.value.comment_id, pageAccessToken, changesEvent.value.post.permalink_url);
                            }
                            callPrivateReplyAPI(changesEvent.value.comment_id, pageAccessToken, inbox);

                            callParseServerCloudCode("incresePageInboxCount", '{"pageId":"' + pageId + '"}', function(res) {

                            });
                          }
                        }
                      });
                    });
                  } else {
                    console.log("getPostMessage response: false");
                  }
                });

              }
            });

          }


        });
      }

    });

    // Assume all went well.
    //
    // You must send back a 200, within 20 seconds, to let us know you've
    // successfully received the callback. Otherwise, the request will time out.
    res.sendStatus(200);
  }
});

function verifyRequestSignature(req, res, buf) {
  var signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    var elements = signature.split('=');
    var method = elements[0];
    var signatureHash = elements[1];

    var expectedHash = crypto.createHmac('sha1', APP_SECRET)
      .update(buf)
      .digest('hex');

    if (signatureHash != expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

// Serve static assets from the /public folder
app.use('/public', express.static(path.join(__dirname, '/public')));
app.use('/dashboard', dashboard);

// Serve the Parse API on the /parse URL prefix
var mountPath = process.env.PARSE_MOUNT || '/parse';
app.use(mountPath, api);

// Parse Server plays nicely with the rest of your web routes
app.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/index.html'));
});

app.post('/loginCallback', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/pages/index.html'));
});

app.get('/test-fb', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/test-fb.html'));
});

// There will be a test page available on the /test path of your server url
// Remove this before launching your app
app.get('/test', function(req, res) {
  res.sendFile(path.join(__dirname, '/public/test.html'));
});


function callParseServerCloudCode(methodName, requestMsg, responseMsg) {
  console.log("callParseServerCloudCode:" + methodName + "\nrequestMsg:" + requestMsg);
  var options = {
    url: process.env.SERVER_URL + '/functions/' + methodName,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Parse-Application-Id': 'myAppId',
      'X-Parse-REST-API-Key': 'myRestKey'
    },
    body: requestMsg
  };

  function callback(error, response, body) {
    //console.log("response:" + JSON.stringify(response));
    if (!error && response.statusCode == 200) {
      var info = JSON.parse(body);
      responseMsg(info.result);
      console.log(methodName + " result: " + JSON.stringify(info.result));
    } else {
      responseMsg(false);
      console.error("Unable to send message. Error :" + error);
    }
  }
  request(options, callback);
}

function getPostMessage(postId, access_token, res) {
  request({
    uri: process.env.FB_GRAPH_URI + postId,
    qs: {
      access_token: access_token,
    }
  }, function(error, response, body) {
    if (!error) {
      console.log("getPostMessage body: " + body);

      var body = JSON.parse(body);

      if (body) {
        console.log("getPostMessage body: " + body);
        res(body);
      } else {
        res(false);
      }
    } else {
      //  var errorMessage = response.error.message;
      //  var errorCode = response.error.code;
      console.error("Unable to send message. Error :" + JSON.stringify(error));
      res(error);
    }
  });
}

function checkTagInComment(commentId, access_token, res) {
  request({
    uri: process.env.FB_GRAPH_URI + commentId + '?fields=message_tags',
    qs: {
      access_token: access_token,
    }
  }, function(error, response, body) {
    if (!error) {
      console.log("checkTagInComment body: " + body);

      var message_tags = JSON.parse(body).message_tags;

      if (message_tags) {
        res(true);
      } else {
        res(false);
      }
    } else {
      //  var errorMessage = response.error.message;
      //  var errorCode = response.error.code;
      console.error("Unable to send message. Error :" + JSON.stringify(error));
      res(error);
    }
  });
}

function callPrivateReplyAPI(commentId, page_access_token, message) {
  request({
    uri: process.env.FB_GRAPH_URI + commentId + '/private_replies',
    qs: {
      access_token: page_access_token,
      message: message
    },
    method: 'POST'
  }, function(error, response, body) {
    if (!error) {
      var messageId = body.id;

      if (messageId) {
        console.log("Successfully callPrivateReplyAPI :%s", messageId);
      }
    } else {
      //  var errorMessage = response.error.message;
      //  var errorCode = response.error.code;
      console.error("callPrivateReplyAPI Error :" + JSON.stringify(error));
    }
  });
}

function callCommentsReplyAPI(commentId, page_access_token, message) {
  request({
    uri: process.env.FB_GRAPH_URI + commentId + '/comments',
    qs: {
      access_token: page_access_token,
      message: message
    },
    method: 'POST'
  }, function(error, response, body) {
    if (!error) {
      var messageId = body.id;

      if (messageId) {
        console.log("Successfully callCommentsReplyAPI :%s", messageId);
      }
    } else {
      //  var errorMessage = response.error.message;
      //  var errorCode = response.error.code;
      console.error("callCommentsReplyAPI Error :" + JSON.stringify(error));
    }
  });
}





var port = process.env.PORT || 1337;
var httpServer = require('http').createServer(app);
httpServer.listen(port, function() {
  console.log('parse-server-example running on port ' + port + '.');
});

// This will enable the Live Query real-time server
ParseServer.createLiveQueryServer(httpServer);
