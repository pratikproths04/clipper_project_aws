// set up ======================================================================
var express = require('express');
var app = express(); 					
var port = process.env.PORT || 8080; 				// set the port
var morgan = require('morgan');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var async = require('async');
var AWS = require('aws-sdk');

app.use(express.static('./public')); 		// set the static files location /public/img will be /img for users
app.use(morgan('dev')); // log every request to the console
app.use(bodyParser.urlencoded({'extended': 'true'})); // parse application/x-www-form-urlencoded
app.use(bodyParser.json()); // parse application/json
app.use(methodOverride('X-HTTP-Method-Override')); // override with the X-HTTP-Method-Override header in the request

AWS.config.region = 'us-east-1b';
var sqs = new AWS.SQS();
var queueUrl;
var params = {
	QueueName: 'clipper-queue1',
	Attributes:{
		ReceiveMessageWaitTimeSeconds: '20',
		VisibilityTimeout: '60'
	}
};

sqs.createQueue(params, function(err, data){
	if(err)	console.log(err, err.stack);
	else{
		console.log('Successfuly created SQS queue URL'+ data.QueueUrl);
		createMessages(data.QueueUrl);
	}
});

function createMessages(queueUrl){
	var messages = [];
	for(var a=0; a<50; a++){
		messages[a] = 'This is the content for message '+a+'.';
	}

	async.each(messages, function(content){
		console.log('Sending message: '+content);
		tempKey = content;
		params = {
				MessageBody: content,
				QueueUrl: queueUrl
		};
		sqs.sendMessage(params, function(err, data){
			if(err)	console.log(err, err.stack);
			else	console.log(data);
		});
	});
}


var waitingSQS = false;
var queueCounter = 0;

setInterval(function(){
	if(!waitingSQS){				//busy with previous request
		if(queueCounter<=0){
			receiveMessages();
		}else	--queueCounter; 
	}
}, 1000);

function receiveMessages(){
	var params = {
		QueueUrl: queueUrl,
		MaxNumberOfMessages: 10,
		VisibilityTimeout: 60,
		WaitTimeSeconds: 20             //wait for messages to arrive
	};
	waitingSQS = true;
	sqs.receiveMessage(params, function(err, data){
		if(err){
			waitingSQS = false;
			console.log(err, err.stack);
		}
		else{
			waitingSQS = false;
			if((typeof data.Messages !== 'undefined')&&(data.Messages.length !== 0)){
				console.log('Received '+ data.Messages.length + ' messages from SQS queue.');
				processMessages(data.Messages);
			}
			else{
				queueCounter = 60;
				console.log('SQS queue empty, waiting for '+ queueCounter + 's.');
			}
		}
	});
}

function processMessages(messagesSQS){
	async.each(messagesSQS, function(content){
		console.log('Processing message: '+ content.Body);
		var params = {
			QueueUrl: queueUrl,
			ReceiptHandle: content.ReceiptHandle
		};
		sqs.deleteMessage(params, function(err, data){
			if(err)	console.log(err, err.stack);
			else{
				console.log('Deleted message RequestId: '+ JSON.stringify(data.ResponseMetadata.RequestId));
				createMessages(data.QueueUrl);
			}
		});
	});
}


// listen (start app with node server.js) ======================================
app.listen(port);
console.log("App listening on port " + port);
