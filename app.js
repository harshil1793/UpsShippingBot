
var restify = require('restify');
var builder = require('botbuilder');
var prompts = require('./prompts');
var locationDialog = require('botbuilder-location');


var Client = require('node-rest-client').Client;
//=========================================================
// Bot Setup
//=========================================================

jsonObject = {
    "AccessRequest": {
                        "AccessLicenseNumber": "AD245999B2916A98", "UserId": "shaikathaque4",
                        "Password": "UPSbot123!"
                    },
        "LocatorRequest": {
                        "Request": {
                        "RequestAction": "Locator", "RequestOption": "1", "TransactionReference": {
                        "CustomerContext": "Find nearest UPS location" }
                    }, 
                    "OriginAddress": {
                        "PhoneNumber": "1234567891", "AddressKeyFormat": {
                        "AddressLine": "11 Times Square", "PoliticalDivision2": "New York City", "PoliticalDivision1": "NY", "PostcodePrimaryLow": "10036", "PostcodeExtendedLow": "", "CountryCode": "US"
                        } },
	                "Translate": { "Locale": "en_US"},
                    "UnitOfMeasurement": {
                        "Code": "MI" },
                        "LocationSearchCriteria": { 
                            "SearchOption": {
                                "OptionType": { "Code": "01"},
                                "OptionCode": {
                                "Code": "002" }
                            },
                            "MaximumListSize": "5", "SearchRadius": "5"}
        }
};


// Setup Restify Server
var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
   console.log('%s listening to %s', server.name, server.url); 
});
  
// Create chat bot
var connector = new builder.ChatConnector({
//     appId: process.env.MICROSOFT_APP_ID,
//     appPassword: process.env.MICROSOFT_APP_PASSWORD
    appId: prompts.AppId,
    appPassword: prompts.AppPass
});
var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());

//=========================================================
// Bots Dialogs
//=========================================================

var model = process.env.model;
var LocationKey = "DefaultLocation";
var ShippingStyleKey = "Shipping Style";
var async = require("async");
var recognizer = new builder.LuisRecognizer('https://westus.api.cognitive.microsoft.com/luis/v2.0/apps/fd9a76fa-9d70-47e3-828c-33ef63fa039f?subscription-key=9aefdc1486b744049db504427816d708');



bot.recognizer(recognizer);
bot.library(locationDialog.createLibrary("Ak2VZoOri8R263-z_IAqqGRcG55S3S5q71H9lSkCsU-1gjnHD1KRUkbeI-zLPp5O"));


bot.dialog('start', function(session){
    session.send("Hi there!");
    session.beginDialog('rootMenu');
}).triggerAction({matches: "Greetings"});

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
]).triggerAction({matches: /^menu/i});


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

bot.dialog('pickup', [
    function (session) {
        builder.Prompts.text(session, prompts.pickupAddressMessage);
    },
    function (session, result) {
        if (validateAddress(result.response)) {
            session.conversationData.pickupAddress = result.response;
            session.send('Your address is: ' + session.conversationData.pickupAddress);
            builder.Prompts.time(session, prompts.pickupTimeMessage);
        } else {
            session.send('Your address is not valid. Please try again');
            session.beginDialog('pickup');
        }
    },
    function (session, result) {
        session.conversationData.pickupTime = builder.EntityRecognizer.resolveTime([result.response]);
        session.send('Your pickup time is: ' + session.conversationData.pickupTime);
        builder.Prompts.text(session, 'Would you like to continue with your shipment?');
    },
    function (session, result) {
        if (result.response === 'yes') {
            session.beginDialog('shipment');
        } else {
            session.beginDialog('help');
        }
    }
]).triggerAction({
    matches: 'pickup',
    onInterrupted: function (session) {
        session.send('Please provide an address.');
    }
});        
bot.dialog('shipment', [
    function(session, results){
        builder.Prompts.text(session, prompts.shipToMessage);
    },
    function (session, results, next){

        session.privateConversationData[LocationKey] = results.response

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
}}]).triggerAction({matches: /^shipment/i});

var returnVals = [];
// takes user address and find nearest location
bot.dialog('dropoff', [function(session){
     var options = {
            prompt: "Please enter your address.",
            useNativeControl: true,
            reverseGeocode: true,
            requiredFields:
                locationDialog.LocationRequiredFields.streetAddress |
                locationDialog.LocationRequiredFields.locality |
                locationDialog.LocationRequiredFields.postalCode 
        };

        locationDialog.getLocation(session, options);
        },
        function (session, results) {
                if (results.response) {
                    var place = results.response;
                    async.waterfall([
                        function(callback){
                            var client = new Client();
                            var responseData = [];
                            jsonObject["LocatorRequest"]["OriginAddress"]["AddressKeyFormat"]["AddressLine"] = place.streetAddress;
                            jsonObject["LocatorRequest"]["OriginAddress"]["AddressKeyFormat"]["PoliticalDivision1"] = place.region;
                            jsonObject["LocatorRequest"]["OriginAddress"]["AddressKeyFormat"]["PostcodePrimaryLow"] = place.postalCode;
                        
                            console.log(jsonObject);
                            var args = {
                                data : JSON.stringify(jsonObject),
                                headers: {"Content-Type": "application/json"}
                            };
                            client.post("https://onlinetools.ups.com/rest/Locator", args, function (data, response) {
                                                // parsed response body as js object 
                                                
                                                responseData = data;
                                                
                                                dropLocations = responseData.LocatorResponse.SearchResults.DropLocation;
                                                for(var i = 0; i < dropLocations.length; i++){
                                                    returnVals[i] = dropLocations[i].AddressKeyFormat.AddressLine;
                                                };
                                                callback(null, returnVals);
                                            });
                        }, 
                        function(arg1, callback){
                                builder.Prompts.choice(session,"Which address do you want to select", returnVals, {listStyle:3});
                        }]);
                }
        },
        function(session,results){
            switch (results.response.index) {
                                case 0:
                                    session.send("Great!");
                                    session.beginDialog("shipment");
                                    break;
                                case 1:
                                    session.send("Great!");
                                    session.beginDialog("shipment");
                                    break;
                                case 2:
                                    session.send("Great!");
                                    session.beginDialog("shipment");
                                    break;
                                default:
                                    
                                    session.send("Great!");
                                    session.beginDialog("shipment");
                                    break;
                                }
                            }
]).triggerAction({
    matches: 'dropoff',
    onInterrupted: function (session) {
        session.send('Please provide an address to find the closest UPS store.');
    }
}); 

bot.dialog('quit', function(session){
    session.endConversation("Have a nice day.")
}).triggerAction({matches: /^quit/i});

bot.dialog('2DayShipping', [
    function(session){
        session.privateConversationData[ShippingStyleKey] = '2 Day Shipping';
        var val= 'You said you would like to send this package using' + ' ' + session.privateConversationData[ShippingStyleKey] +
        " to " + session.privateConversationData[LocationKey]+ " is this correct?"
        builder.Prompts.choice(session,val, "Yes|No", {listStyle:3})
    },
    function(session,results){
        switch (results.response.index) {
                case 0:
                    var card = createLabel(session);
                    var msg = new builder.Message(session).addAttachment(card);
                    session.send(msg);
                    session.beginDialog('reship');
                    break;
                case 1:
                    session.send("Okay, lets start over.");
                    session.endDialog();
                    break;
        }
    }
]).triggerAction({matches: /^2 Day Delivery/i});

bot.dialog('GroundShipping', [
        function(session){
            session.privateConversationData[ShippingStyleKey] = 'Ground Shipping';
            var val= 'You said you would like to send this package using' + ' ' + session.privateConversationData[ShippingStyleKey] +
            " to " + session.privateConversationData[LocationKey]+ " is this correct?"
            builder.Prompts.choice(session,val, "Yes|No", {listStyle:3})
        },
        function(session,results){
            switch (results.response.index) {
                    case 0:
                        session.send("Great! Here is your shipping label.");
                        var card = createLabel(session);
                        var msg = new builder.Message(session).addAttachment(card);
                        session.send(msg);
                        session.beginDialog('reship');
                        break;
                    case 1:
                        session.send("Okay, lets start over.");
                        session.beginDialog("help");
                        break;
                
            }
        }
]).triggerAction({matches: /^Ground Shipping/i});


function createLabel(session){
    return new builder.HeroCard(session)
        .title("UPS")
        .subtitle("Shipping Label")
        .images([
            builder.CardImage.create(session, "http://www.cuspdental.com/img/UPSLabel.jpg")
        ])
}
// bot.dialog('printlabel', [function(session){
//     var picture = new builder.Message(session)
//             .textFormat(builder.TextFormat.xml)
//             .attachments([
//                 new builder.HeroCard(session)
//                     .title("UPS")
//                     .subtitle("Shipping Label")
//                     .images([
//                         builder.CardImage.create(session, "http://www.cuspdental.com/img/UPSLabel.jpg")
//                     ])
//             ]);
//     session.send(picture);
//     },
//     function(session){
//         session.beginDialog('reship');
// }]).triggerAction({matches: /^printlabel/i})

bot.dialog('reship', [
    function(session){
        builder.Prompts.choice(session, 'Would you like to place another order?', 'Yes|No', {listStyle:3})
    },
    function (session, results) {
            switch (results.response.index) {
                case 0:
                    session.beginDialog('rootMenu');
                    break;
                case 1:
                    session.beginDialog('quit');                    
                    break;
                default:
                    session.beginDialog('quit');   
            }
    }
]).triggerAction({matches: /^reship/i});


function validateAddress(string) {
    if (isNaN(string.split(' ')[0])) {
        return false;
    }
    return true;
}
