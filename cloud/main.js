var appQueryLimit = 99999;
var freeQuota = 1000;
var wordcut = require("wordcut");
var _ = require('underscore');

const APP_SECRET = (process.env.FB_APP_SECRET) ?
  process.env.FB_APP_SECRET :
  config.get('appSecret');

const VALIDATION_TOKEN = (process.env.FB_VALIDATION_TOKEN) ?
  (process.env.FB_VALIDATION_TOKEN) :
  config.get('validationToken');

  const CLIENT_ID = (process.env.FB_CLIENT_ID) ?
    process.env.FB_CLIENT_ID :
    config.get('clientId');

wordcut.init();

Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

Parse.Cloud.define('removeReplyNode', function(req, res) {
  var objectId = req.params.objectId;
  var query = new Parse.Query("ReplyNode");
  query.equalTo("objectId", objectId);
  query.first({
    useMasterKey: true
  }).then(function(object) {
    if (!object) {
      res.error();
    } else {
      object.destroy({
        useMasterKey: true
      }).then(function(object) {
        if (!object) {
          res.error();
        } else {
          res.success('success');
        }
      }, function(error) {
        res.error(error);
      });
    }
  }, function(error) {
    res.error(error);
  });
});

Parse.Cloud.define("findMatchReply", function(request, response) {

  var ReplyNode = Parse.Object.extend("ReplyNode");
  var comment = request.params.comment;
  var post = request.params.post;
  var pageId = request.params.pageId;
  var isHasTag = request.params.isHasTag;
  console.log("params:" + JSON.stringify(request.params));
  var wc = wordcut.cut(comment)
  let arr = wc.split('|');
  var hashtagArray = [""];
  //    /#[^\p{Lu}\p{Ll}+( \p{Lu}\p{Ll}+)*$]+/g

  if (post.match(/#[a-z&0-9&_]+/gi) != null) {
    hashtagArray = post.match(/#[a-z&0-9&_]+/gi);
  }

  var replyMsg = '';
  var inboxMsg = '';
  var data = {};

  console.log("wordcut:" + wordcut.cut(comment));
  console.log("comment array wordcutted:" + JSON.stringify(arr));
  console.log(" hashtagArrayFromPostMessage : " + hashtagArray);
  if (comment == null || pageId == null) {
    response.error("request null values");

  } else {

    var pageQuery = new Parse.Query("PageNode");
    pageQuery.equalTo("pageId", pageId);
    pageQuery.first({
      useMasterKey: true
    }).then(function(pageObject) {
      if (!pageObject) {
        response.error("cannot get pageNode");
      } else {

        var isShowPostLink = pageObject.get('isShowPostLink');

        if (!(pageObject.get('tagFilter') == true && isHasTag == true)) {

          var query = new Parse.Query(ReplyNode);
          query.equalTo("pageId", pageId);
          query.containedIn("inputWordsArray", arr);
          //if (hashtagArray.length != 0) {
          query.containedIn("hashtag", hashtagArray);
          //}
          query.limit(appQueryLimit);
          query.find({
            useMasterKey: true
          }).then(function(replyObjects) {
            if (replyObjects.length == 0) {
              if (hashtagArray.length != 0) {
                var query2 = new Parse.Query(ReplyNode);
                query2.equalTo("pageId", pageId);
                query2.containedIn("hashtag", hashtagArray);
                query2.containedIn("inputWordsArray", [""]);
                query2.find({
                  useMasterKey: true
                }).then(function(objects) {
                  if (objects.length == 0) {
                    //response.success(false);
                    console.log("use default reply case 0");

                    var reply = pageObject.get('defaultReply');
                    var inbox = pageObject.get('defaultInbox');
                    if (reply.length != 0) {
                      replyMsg = reply[Math.floor((Math.random() * reply.length) + 0)];
                    }
                    if (inbox.length != 0) {
                      inboxMsg = inbox[Math.floor((Math.random() * inbox.length) + 0)];
                    }
                    if (pageObject.get('autoreply') && (pageObject.get('replyQuota') > pageObject.get('replyUsage'))) {
                      data.reply = replyMsg;
                    }
                    if (pageObject.get('autoinbox') && (pageObject.get('inboxQuota') > pageObject.get('inboxUsage'))) {
                      data.inbox = inboxMsg;
                    }
                    if (isShowPostLink){
                      data.isShowPostLink = isShowPostLink;
                    }
                    response.success(data);
                  } else {
                    console.log("case1 objects[0]:" + JSON.stringify(objects[0]));
                    var reply = objects[0].get('reply');
                    var inbox = objects[0].get('inbox');
                    if (reply.length != 0) {
                      replyMsg = reply[Math.floor((Math.random() * reply.length) + 0)];
                    }
                    if (inbox.length != 0) {
                      inboxMsg = inbox[Math.floor((Math.random() * inbox.length) + 0)];
                    }
                    if (pageObject.get('autoreply') && (pageObject.get('replyQuota') > pageObject.get('replyUsage'))) {
                      data.reply = replyMsg;
                    }
                    if (pageObject.get('autoinbox') && (pageObject.get('inboxQuota') > pageObject.get('inboxUsage'))) {
                      data.inbox = inboxMsg;
                    }
                    if (isShowPostLink){
                      data.isShowPostLink = isShowPostLink;
                    }
                    response.success(data);
                  }
                }, function(error) {
                  response.error(error);
                });

              } else {
                // use default
                console.log("use default reply");

                var reply = pageObject.get('defaultReply');
                var inbox = pageObject.get('defaultInbox');
                if (reply.length != 0) {
                  replyMsg = reply[Math.floor((Math.random() * reply.length) + 0)];
                }
                if (inbox.length != 0) {
                  inboxMsg = inbox[Math.floor((Math.random() * inbox.length) + 0)];
                }
                if (pageObject.get('autoreply') && (pageObject.get('replyQuota') > pageObject.get('replyUsage'))) {
                  data.reply = replyMsg;
                }
                if (pageObject.get('autoinbox') && (pageObject.get('inboxQuota') > pageObject.get('inboxUsage'))) {
                  data.inbox = inboxMsg;
                }
                if (isShowPostLink){
                  data.isShowPostLink = isShowPostLink;
                }
                response.success(data);
              }
            } else {
              console.log("case2 replyObjects[0]:" + JSON.stringify(replyObjects[0]));
              var reply = replyObjects[0].get('reply');
              var inbox = replyObjects[0].get('inbox');
              if (reply.length != 0) {
                replyMsg = reply[Math.floor((Math.random() * reply.length) + 0)];
              }
              if (inbox.length != 0) {
                inboxMsg = inbox[Math.floor((Math.random() * inbox.length) + 0)];
              }
              if (pageObject.get('autoreply') && (pageObject.get('replyQuota') > pageObject.get('replyUsage'))) {
                data.reply = replyMsg;
              }
              if (pageObject.get('autoinbox') && (pageObject.get('inboxQuota') > pageObject.get('inboxUsage'))) {
                data.inbox = inboxMsg;
              }
              if (isShowPostLink){
                data.isShowPostLink = isShowPostLink;
              }
              response.success(data);
            }

          }, function(error) {
            response.error(error);
          });
        }
      }
    }, function(error) {
      response.error(error);
    });

  }
});




Parse.Cloud.define('getPageAccessTokenFromPageId', function(req, res) {
  var pageId = req.params.pageId;
  var PageNode = Parse.Object.extend("PageNode");
  var query = new Parse.Query(PageNode);
  query.equalTo("pageId", pageId);
  query.first({
    useMasterKey: true
  }).then(function(object) {
    if (!object) {
      res.error("page not found");
    } else {
      console.log("getPageAccessTokenFromPageId node:" + JSON.stringify(object));

      var userId = object.get('userId');
      console.log("getPageAccessTokenFromPageId userId:" + userId);

      var userQuery = new Parse.Query("FBUser");
      userQuery.equalTo("userId", userId);
      userQuery.first({
        useMasterKey: true
      }).then(function(user) {
        if (!user) {
          res.error("user not found");
        } else {
          var userAccess = user.get('access_token');
          var url = process.env.FB_GRAPH_URI + pageId + '?fields=access_token&access_token=' + userAccess;
          Parse.Cloud.httpRequest({
            url: url
          }).then(function(httpResponse) {
            var page_access_token = JSON.parse(httpResponse.text).access_token;
            //save page accessToken
            object.set("pageAccessToken",page_access_token);
            object.save(null, {useMasterKey: true});

            res.success(page_access_token);


          }, function(httpResponse) {
            res.error('Request failed with response code ' + httpResponse.status);
          });
        }
      }, function(error) {
        res.error(error);
      });
    }
  }, function(error) {
    res.error(error);
  });
});


Parse.Cloud.define('getPageOwnerFromPageId', function(req, res) {
  var pageId = req.params.pageId;
  var PageNode = Parse.Object.extend("PageNode");
  var query = new Parse.Query(PageNode);
  query.equalTo("pageId", pageId);
  query.first({
    useMasterKey: true
  }).then(function(object) {
    if (!object) {
      res.error("page not found");
    } else {
      var userId = object.userId;
      var userQuery = new Parse.Query("FBUser");
      userQuery.equalTo("userId", userId);
      userQuery.first({
        useMasterKey: true
      }).then(function(user) {
        if (!user) {
          res.error("user not found");
        } else {
          res.success(user);
        }
      }, function(error) {
        res.error(error);
      });
    }
  }, function(error) {
    res.error(error);
  });
});

Parse.Cloud.define('getPageReplyNode', function(req, res) {
  var pageId = req.params.pageId;
  var ReplyNode = Parse.Object.extend("ReplyNode");
  var query = new Parse.Query(ReplyNode);
  query.equalTo("pageId", pageId);
  query.limit(appQueryLimit);
  query.find({
    useMasterKey: true
  }).then(function(objects) {
    if (!objects) {
      res.success([]);
    } else {
      res.success(objects);
    }
  }, function(error) {
    res.error(error);
  });
});

Parse.Cloud.define('saveReplyNode', function(request, response) {

  var ReplyNode = Parse.Object.extend("ReplyNode");
  var replyNodeId = request.params.replyNodeId;
  var hashtagFromUser = request.params.hashtag;
  var inputFromUser = request.params.input;
  var replyMsgFromUser = request.params.reply;
  var inboxFromUser = request.params.inbox;
  var pageId = request.params.pageId;
  console.log("params:" + JSON.stringify(request.params));
  if (replyNodeId) {
    // update
    var query = new Parse.Query(ReplyNode);
    query.equalTo("objectId", replyNodeId);
    query.first({
      useMasterKey: true
    }).then(function(object) {
      if (!object) {
        response.error("cannot find replynode from this objId");
      } else {
        object.set("hashtag", hashtagFromUser);
        object.set("input", inputFromUser);
        object.set("reply", replyMsgFromUser);
        object.set("inbox", inboxFromUser);
        object.set("pageId", pageId);

        var msgChar = inputFromUser.join('');
        var wc = wordcut.cut(msgChar)
        let arr = wc.split('|');
        object.set("inputWordsArray", arr);
        object.save(null, {
          useMasterKey: true,
          success: function(success) {
            response.success({
              "objectId": object.objectId,
              "hashtag": hashtagFromUser,
              "input": inputFromUser,
              "reply": replyMsgFromUser,
              "inbox": inboxFromUser
            });
          },
          error: function(error) {
            response.error("save failed : " + error.code);
          }
        });
      }
    }, function(error) {
      response.error(error);
    });
  } else {
    // create new
    var obj = new ReplyNode();
    obj.set("hashtag", hashtagFromUser);
    obj.set("input", inputFromUser);
    obj.set("reply", replyMsgFromUser);
    obj.set("inbox", inboxFromUser);
    obj.set("pageId", pageId);

    var msgChar = inputFromUser.join('');
    var wc = wordcut.cut(msgChar)
    let arr = wc.split('|');
    obj.set("inputWordsArray", arr);
    obj.save(null, {
      useMasterKey: true,
      success: function(success) {
        response.success({
          "hashtag": hashtagFromUser,
          "input": inputFromUser,
          "reply": replyMsgFromUser,
          "inbox": inboxFromUser
        });
      },
      error: function(error) {
        response.error("save failed : " + error.code);
      }
    });
  }


});

Parse.Cloud.define('checkAccessExpiration', function(req, res) {
  var access_token = req.params.access_token;
  var userId = req.params.userId;
  var FBUser = Parse.Object.extend("FBUser");

  var getAppAccessTokenUrl = 'https://graph.facebook.com/oauth/access_token?client_id='+ CLIENT_ID +'&client_secret=' + APP_SECRET + '&grant_type=client_credentials';
  Parse.Cloud.httpRequest({
    url: getAppAccessTokenUrl
  }).then(function(httpResponse) {
    console.log("AppAccessToken : " + httpResponse.text);
    var app_access_token = JSON.parse(httpResponse.text).access_token;
    // 1. convert access token to long live access token
    var url = 'https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=' + CLIENT_ID + '&client_secret=' + APP_SECRET + '&fb_exchange_token=' + access_token;
    console.log("checkAccessExpiration url: " + url);
    Parse.Cloud.httpRequest({
      url: url
    }).then(function(httpResponse) {
      console.log("checkAccessExpiration http req: " + httpResponse.text);
      var long_live_access_token = JSON.parse(httpResponse.text).access_token;
      // 2. get real expire from long_live_access_token
      var url2 = 'https://graph.facebook.com/debug_token?input_token=' + long_live_access_token + '&access_token=' + app_access_token;
      console.log("checkAccessExpiration debug url: " + url2);
      Parse.Cloud.httpRequest({
        url: url2
      }).then(function(httpResponse) {
        console.log("debug_token http req: " + httpResponse.text);
        var expires_at = JSON.parse(httpResponse.text).data.expires_at;
        // 3. get user from userId
        var query = new Parse.Query("FBUser");
        query.equalTo("userId", userId);
        query.first({
          useMasterKey: true
        }).then(function(object) {
          if (!object) {
            // create ne user
            var user = new FBUser();
            user.set('userId', userId);
            user.set('access_token', long_live_access_token);
            user.set('expires_at', expires_at);

            user.save(null, {
              useMasterKey: true,
              success: function(object) {
                res.success("success");
              },
              error: function(model, error) {
                res.error("save error:" + error);
              }
            });

          } else {
            var this_time = Math.floor(Date.now() / 1000);
            var old_expires_at = object.get('expires_at');
            if ((old_expires_at - this_time) <= 0) {
              //expired
              object.set('access_token', long_live_access_token);
              object.set('expires_at', expires_at);
              object.save(null, {
                useMasterKey: true,
                success: function(object) {
                  res.success("success");
                },
                error: function(model, error) {
                  res.error("save error:" + error);
                }
              });
            } else if ((old_expires_at - this_time) <= 86400) {
              //1 day left
              res.success("warn");
            } else {
              //valid
              res.success("success");
            }
          }
        }, function(error) {
          res.error(error);
        });

      }, function(httpResponse) {
        res.error('Request failed with response code ' + httpResponse.status);
      });
    }, function(httpResponse) {
      res.error('Request failed with response code ' + httpResponse.status);
    });

  }, function(httpResponse) {
    res.error('Request failed with response code ' + httpResponse.status);
  });
});


Parse.Cloud.define('createPageNode', function(req, res) {
  var data = req.params.data;
  var userId = req.params.userId;
  var PageNode = Parse.Object.extend("PageNode");
  var query = new Parse.Query("PageNode");
  query.equalTo("pageId", data.id);
  query.first({
    useMasterKey: true
  }).then(function(object) {
    if (!object) {
      var inboxmsg = 'สวัสดีคะ ' + data.name + ' ยินดีให้บริการนะคะ';
      var replymsg = 'สวัสดีคุณลูกค้าสนใจสอบถามข้อมูลเพิ่มเติมได้ ทาง Inbox หรือ Comment เลยนะคะ' + '\n' + data.name + 'ขอขอบคุณลูกค้าที่น่ารักทุกคน';
      var pageNode = new PageNode();
      pageNode.set('userId', userId);
      pageNode.set('pageId', data.id);
      pageNode.set('pageName', data.name);
      pageNode.set('autoreply', false);
      pageNode.set('autoinbox', false);
      pageNode.set('tagFilter', false);
      pageNode.set('startServer', true);
      pageNode.set('defaultReply', [replymsg]);
      pageNode.set('defaultInbox', [inboxmsg]);
      pageNode.set('replyCount', 0);
      pageNode.set('inboxCount', 0);
      pageNode.set('replyQuota', freeQuota);
      pageNode.set('replyUsage', 0);
      pageNode.set('inboxQuota', freeQuota);
      pageNode.set('inboxUsage', 0);
      pageNode.set('isVerifyPage', false);
      pageNode.set('isShowPostLink', false);
      pageNode.set('isShowReplyInbox', false);
      pageNode.save(null, {
        useMasterKey: true,
        success: function(object) {
          res.success(object);
        },
        error: function(model, error) {
          res.error("save error:" + error);
        }
      });
    } else {
      res.success("connected");
    }
  }, function(error) {
    res.error(error);
  });
});

Parse.Cloud.define('getUserPageNode', function(req, res) {
  var userId = req.params.userId;
  var PageNode = Parse.Object.extend("PageNode");
  var query = new Parse.Query("PageNode");
  query.equalTo("userId", userId);
  query.find({
    useMasterKey: true
  }).then(function(objects) {
    if (!objects) {
      res.success([]);
    } else {
      res.success(objects);
    }
  }, function(error) {
    res.error(error);
  });
});

Parse.Cloud.define('getPageNode', function(req, res) {
  var objectId = req.params.objectId;
  var query = new Parse.Query("PageNode");
  query.equalTo("objectId", objectId);
  query.first({
    useMasterKey: true
  }).then(function(object) {
    if (!object) {
      res.success();
    } else {
      res.success(object);
    }
  }, function(error) {
    res.error(error);
  });
});

Parse.Cloud.define('incresePageReplyCount', function(req, res) {
  var pageId = req.params.pageId;
  var query = new Parse.Query("PageNode");
  query.equalTo("pageId", pageId);
  query.first({
    useMasterKey: true
  }).then(function(object) {
    if (!object) {
      res.error('cannot find page with this pageId:' + pageId);
    } else {
      object.increment("replyCount");
      object.increment("replyUsage");
      object.save(null, {
        useMasterKey: true,
        success: function(object) {
          res.success("success");
        },
        error: function(model, error) {
          res.error("save error:" + error);
        }
      });
    }
  }, function(error) {
    res.error(error);
  });
});
Parse.Cloud.define('incresePageInboxCount', function(req, res) {
  var pageId = req.params.pageId;
  var query = new Parse.Query("PageNode");
  query.equalTo("pageId", pageId);
  query.first({
    useMasterKey: true
  }).then(function(object) {
    if (!object) {
      res.error('cannot find page with this pageId:' + pageId);
    } else {
      object.increment("inboxCount");
      object.increment("inboxUsage");
      object.save(null, {
        useMasterKey: true,
        success: function(object) {
          res.success("success");
        },
        error: function(model, error) {
          res.error("save error:" + error);
        }
      });
    }
  }, function(error) {
    res.error(error);
  });
});


Parse.Cloud.define('setSystemStatus', function(req, res) {
  var objectId = req.params.objectId;
  var status = req.params.status;
  var type = req.params.type;

  var query = new Parse.Query("PageNode");
  query.equalTo("objectId", objectId);
  query.first({
    useMasterKey: true
  }).then(function(object) {
    if (!object) {
      res.success("fail");
    } else {
      object.set(type, status);
      object.save(null, {
        useMasterKey: true,
        success: function(object) {
          res.success("success");
        },
        error: function(model, error) {
          res.error("save error:" + error);
        }
      });
    }
  }, function(error) {
    res.error(error);
  });
});

Parse.Cloud.define('setDefaultValue', function(req, res) {
  var objectId = req.params.objectId;
  var reply = req.params.reply;
  var inbox = req.params.inbox;
  console.log("inbox: " + inbox);
  console.log("reply: " + reply);

  var query = new Parse.Query("PageNode");
  query.equalTo("objectId", objectId);
  query.first({
    useMasterKey: true
  }).then(function(object) {
    if (!object) {
      res.success("fail");
    } else {
      object.set("defaultInbox", inbox);
      object.set("defaultReply", reply);
      object.save(null, {
        useMasterKey: true,
        success: function(object) {
          res.success("success");
        },
        error: function(model, error) {
          res.error("save error:" + error);
        }
      });
    }
  }, function(error) {
    res.error(error);
  });
});
