var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');

//=========================================================
// Bot Setup
//=========================================================

// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
    appId: process.env.MICROSOFT_APP_ID,
    // appId: null,
    // appPassword: null
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Bots Dialogs
//=========================================================

var model = process.env.model;
var recognizer = new builder.LuisRecognizer('');
var intents = new builder.IntentDialog({recognizers:[recognizer]});
var LocationKey = "DefaultLocation";
var ShippingStyleKey = "Shipping Style";

bot.recognizer(recognizer);

bot.dialog('start', function(session){
    session.send("Hi there!");
    session.beginDialog('rootMenu');
}).triggerAction({matches: /^hello/i})

bot.dialog('rootMenu', [
    function (session) {
        builder.Prompts.choice(session, "Choose an option:", 'Pickup|Dropoff at UPS|Quit',{listStyle:3});
    },
    function (session, results) {
        switch (results.response.index) {
            case 0:
                session.beginDialog('pickup');
                break;
            case 1:
                session.beginDialog('dropoff');
                break;
            case 2:
                session.beginDialog('quit');
                break;
            default:
                session.endDialog();
                break;
        }
    }
]).triggerAction({matches: /^menu/i}),


bot.dialog('help', [
    function(session){
        session.send(prompts.helpMessage),
        builder.Prompts.choice(session, "Do you want to start a new order?", "Yes|No",{listStyle:3})
    },
    function(session, results){
         switch (results.response.index) {
            case 0:
                session.beginDialog('rootMenu');
                break;
            case 1:
                session.beginDialog('quit');
                break;
            default:
                session.endDialog();
                break;
    }
}]).triggerAction({matches: /^help/i});

bot.dialog('pickup', function(session){
    session.send("HERE");
}).triggerAction({matches : /^pickup/i});

bot.dialog('dropoff', function(session){
    session.send('dropoff here');
}).triggerAction({matches: /^dropoff/i});

bot.dialog('quit', function(session){
    session.endConversation("Have a nice day.")
}).triggerAction({matches: /^quit/i})

//  var msg = new builder.Message(session)
//             .textFormat(builder.TextFormat.xml)
//             .attachments([
//                 new builder.ThumbnailCard(session)
//                     // .title("Please choose pickup or dropoff for your shipment.")
//                     // .subtitle("Space Needle")
//                     // .text("The <b>Space Needle</b> is an observation tower in Seattle, Washington, a landmark of the Pacific Northwest, and an icon of Seattle.")
//                     // .images([
//                     //     builder.CardImage.create(session, "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Seattlenighttimequeenanne.jpg/320px-Seattlenighttimequeenanne.jpg")
//                     // ])
//                     // .tap(builder.CardAction.openUrl(session, "https://en.wikipedia.org/wiki/Space_Needle"))
//                     .buttons([
//                         builder.CardAction.imBack(session,'pickup', "pickup"),
//                         builder.CardAction.imBack(session,'dropoff', "dropoff")])
                        
//             ]);
bot.dialog('shipment', [function(session, results){
builder.Prompts.text(session, prompts.shipToMessage);
},
function (session, results, next){

    session.privateConversationData[LocationKey] = results.response
    session.send('You said your location is ' + session.privateConversationData[LocationKey]);

    builder.Prompts.choice(session, "Great. What shipping speed would you like?", '2 Day Delivery|Ground Shipping|Cancel',{listStyle:3});
    switch (results.response.index) {
            case 0:
                session.beginDialog('2DayShipping');
                break;
            case 1:
                session.beginDialog('Ground Shipping');
                 break;
            case 2:
                session.beginDialog('quit');
                break;
            default:
                session.endDialog();
                break;
}}]).triggerAction({matches: /^shipment/i})

bot.dialog('2DayShipping', [function(session, resutlts){
    session.privateConversationData[ShippingStyleKey] = '2DayShipping';
    session.send('You said you would like to send this package using' + ' ' + session.privateConversationData[ShippingStyleKey] +
    " to " + session.privateConversationData[LocationKey]);



}]).triggerAction({matches: /^2 Day Delivery/i})


bot.dialog('GroundShipping', [function(session, resutlts){
    session.privateConversationData[ShippingStyleKey] = 'GroundShipping';
    session.send('You said you would like to send this package using' + ' ' + session.privateConversationData[ShippingStyleKey] +
    " to " + session.privateConversationData[LocationKey]);


}]).triggerAction({matches: /^Ground Shipping/i})
