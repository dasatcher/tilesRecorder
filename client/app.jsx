'use strict';

var React = require('react');
var moment = require('moment');
var socket = io.connect();
var execSoc = io.connect();

var userTiles = [];
socket.on('init', function(data){
	userTiles = data;
	
});

var MessageForm = React.createClass({

	getInitialState() {
		return {text: ''};
	},

	handleSubmit(e) {
		e.preventDefault();
		var message = {
			user : this.props.user,
			text : this.state.text
		}
		this.props.onMessageSubmit(message);	
		this.setState({ text: '' });
	},

	changeHandler(e) {
		this.setState({ text : e.target.value });
	},

	render() {
		return(
			<div className='message_form'>
				<h3>Write New Message</h3>
				<form onSubmit={this.handleSubmit}>
					<input
						onChange={this.changeHandler}
						value={this.state.text}
					/>
				</form>
			</div>
		);
	}
});



var ChatApp = React.createClass({

	getInitialState() {
		return {users: [], messages:[], text: ''};
	},

	componentDidMount() {
		socket.on('init', this._initialize);
		socket.on('init2', this._printmsg);
		socket.on('send:message', this._messageRecieve);
		socket.on('user:join', this._userJoined);
		socket.on('user:left', this._userLeft);
		socket.on('change:name', this._userChangedName);
	},
	_printmsg(msg) {
		console.log("into print msg");
		console.log(msg);
	},

	_initialize(data) {
		var {users, name} = data;
		
		this.setState({users, user: name});
	},

	_messageRecieve(message) {
		var {messages} = this.state;
		console.log(message);
		messages.push(message);
		this.setState({messages});
	},

	_userJoined(data) {
		var {users, messages} = this.state;
		var {name} = data;
		users.push(name);
		messages.push({
			user: 'APPLICATION BOT',
			text : name +' Joined'
		});
		this.setState({users, messages});
	},

	_userLeft(data) {
		var {users, messages} = this.state;
		var {name} = data;
		var index = users.indexOf(name);
		users.splice(index, 1);
		messages.push({
			user: 'APPLICATION BOT',
			text : name +' Left'
		});
		this.setState({users, messages});
	},

	_userChangedName(data) {
		var {oldName, newName} = data;
		var {users, messages} = this.state;
		var index = users.indexOf(oldName);
		users.splice(index, 1, newName);
		messages.push({
			user: 'APPLICATION BOT',
			text : 'Change Name : ' + oldName + ' ==> '+ newName
		});
		this.setState({users, messages});
	},

	handleMessageSubmit(message) {
		var {messages} = this.state;
		messages.push(message);
		this.setState({messages});
		socket.emit('send:message', message);
	},

	handleChangeName(newName) {
		var oldName = this.state.user;
		socket.emit('change:name', { name : newName}, (result) => {
			if(!result) {
				return alert('There was an error changing your name');
			}
			var {users} = this.state;
			var index = users.indexOf(oldName);
			users.splice(index, 1, newName);
			this.setState({users, user: newName});
		});
	},

	render() {
		return (
			<div>
				<UsersList
					users={this.state.users}
				/>
				<MessageList
					messages={this.state.messages}
				/>
				<MessageForm
					onMessageSubmit={this.handleMessageSubmit}
					user={this.state.user}
				/>
				<ChangeNameForm
					onChangeName={this.handleChangeName}
				/>
			</div>
		);
	}
});

var tileResponse = function(tileId, cmdString,param1,param2){
	this.tileId = tileId;
	this.cmdString = cmdString;
	this.param1 = param1 ? param1: null;
	this.param2 = param2 ? param2:null;
	
	this.execute = function(){
		socket.emit("tileCmd",this);
	}
}

var Executor = React.createClass({
	getInitialState() {
		var events = this.props.eventList.slice(0); //doing a shallow copy, never want to edit props directly
		return {
        active: true,
		eventList: events,
		lastSuccessTime: null
		
              
    }
	},
	componentDidMount() {
		execSoc.on('tileEvent', this.evaluate);
	},
	evaluate(msg){
		console.log("in evaluate, here is curr event in event list");
		console.log(this.state.eventList);
		console.log(this.props.eventList);
		
		if(this.state.active){
			var tileEvent = msg.event;
			var tileId = msg.tileId;
			var eventReceived = moment().valueOf();
			var currEventList = this.state.eventList;
			console.log("event tileId: "+tileId+" event type: "+tileEvent.properties[0]);
			console.log("lastSuccessTime: "+this.state.lastSuccessTime+" eventReceived: "+eventReceived);
			var success = false;
			if(this.state.eventList[0].tileId === tileId && this.state.eventList[0].type === tileEvent.properties[0]){
				success = true;
				
				console.log("event in event list matches event that came in");
				if(this.state.eventList[0].options.timeLimit && this.state.lastSuccessTime){
					console.log("inside time check");
					console.log("time limite "+this.state.eventList[0].options.timeLimit);
					
					if(this.state.eventList[0].options.timeLimit < (eventReceived - this.state.lastSuccessTime)) {
					console.log("time fail");
					success= false;
					if(this.state.eventList[0].options.terminTime) this.terminate();
					}
				}	
		}
		if(success){
					console.log("success");
				if(this.state.eventList[0].options.executeSuccess){
					this.execute(this.state.eventList[0].options.executeSuccess);
				}
				//remove event from list
				currEventList.shift();
				
				console.log("events left length: "+currEventList.length)
				
				currEventList.length > 0 ? this.setState({eventList: currEventList, lastSuccessTime: eventReceived }) : this.terminate();
			}
		else if(this.state.eventList[0].options.executeFail){
			this.execute(this.state.eventList[0].options.executeFail);
		}
		
		
		}
	},
	execute(ex){
		console.log("sequence completed!");
		//var tileB = new tileResponse("F6:AB:53:52:53:84","led","on","red");
		//tileB.execute();
		ex.execute();
	},
	terminate(){
		this.setState({active:false, eventList:this.props.eventList, lastSuccessTime:null}); //reset our executor
	},
	render(){
		return (
		<div>Hi i'm a listener/executor with a name {this.props.name}</div>
		)
	}
});

var OptionsWindow = React.createClass(
	{
		getInitialState(){
			return {
				resType:null,
				param2:false
			}
		},
		setResType(e){
			this.setState({resType:e.target.value});
		},
		setParam1(e){
			console.log(e.target.options[e.target.selectedIndex].dataset.has2param);
			e.target.options[e.target.selectedIndex].dataset.has2param === "true"? this.setState({param2:true}) : this.setState({param2:false}) 
		},
		setDeviceSelect(e){
		this.setState({deviceSelect: e.target.value});
	},
		buildTileNames(){
		return userTiles.map( (tile) =>
		<option value={tile.id}>{tile.name}</option>

		);
	},
		handleTileSubmit(e){
			e.preventDefault();
			var option2;
			if(this.state.deviceSelect === "led") option2 = e.target.option2.value
			var myResponse = new tileResponse(e.target.tileSelect.value,e.target.outputDevice.value,e.target.option1.value,option2);
			this.props.handleSubmit(myResponse);
		},
		buildForm(){
			if(this.state.resType === "sTile"){
				return (
					<form name="tileResponse" onSubmit={this.handleTileSubmit}>
						<label>Tile Name </label>
						<select name="tileSelect">
							{
								this.buildTileNames()
							}
						</select>
						<label>Output Device</label>
						<select name="outputDevice" onChange={this.setDeviceSelect}>
							<option >Choose Output</option>
							<option value="led">led</option>
							<option value="haptic">haptic</option>
						</select>
						<label name="commands">Command</label>
						{this.state.deviceSelect === "led" &&
						<div>
						<select name="option1" onChange={this.setParam1}>
							<option data-has2param="false">Choose Command</option>
							<option data-has2param="true">on</option>
							<option data-has2param="false">off</option>
							<option data-has2param="true">blink</option>
							<option data-has2param="true">fade</option>
						</select>
						{console.log("Just before option 2, param2 in state is "+this.state.param2)}
						{this.state.param2  === true &&
						
						<select name="option2">
							<option>white</option>
							<option>red</option>
							<option>green</option>
							<option>blue</option>
						</select>
						
						}
						
						
						</div>}
						{this.state.deviceSelect === "haptic" &&
					<div>
						<select name="option1">
							<option>long</option>
							<option>burst</option>
						</select>
					</div>
						}
						<input type="submit" value="Save" />
					</form>
				)
			}
		},
		render(){
			return (
			<div>
				<select name="responseSelector" onChange={this.setResType}>
					<option>Choose Response</option>
					<option value="sTile">Single Tile</option>
				</select>
				{this.buildForm()}
			</div>
			
			);

		}
	}
);


var Event = React.createClass({
	getInitialState() {
		return {
       options: { timeLimit: null,
	   terminId:false,
	   terminTime:false,
	   executeSuccess:null,
	   executeFail:null},
	   minutes:false

    }
	},
	renderTimeUnits(){
		var days = [];
		
		for(var i=0;i<=60;i++){
			days.push(<option key={i}>{i}</option>);
		}
		
		return days;
	},
	setTimeScale(e){
		
		this.setState({minutes: e.currentTarget.value});
	},
	handleTimeSubmit(e){
		e.preventDefault();
	
		var value = e.target.timeSelector.value*1000;
		console.log(this.state.minutes);
		if(this.state.minutes) value *=60;
		this.state.options.timeLimit = value;
		console.log("time limit new value "+value);
		this.props.updateEvent(this.props.propKey,this.state.options);
		this.setState(this.state);

	},
	handleSuccessSubmit(res){
		
		this.state.options.executeSuccess = res;
		this.props.updateEvent(this.props.propKey,this.state.options);
		this.setState(this.state);

	},
	handleFailSubmit(res){
		
		this.state.options.executeFail = res;
		this.props.updateEvent(this.props.propKey,this.state.options);
		this.setState(this.state);

	},
	buildTimeSelector(){
		return (
			<form name="setTime" onSubmit={this.handleTimeSubmit}>
			<label>Set event time window</label>
						<select name="timeSelector">
							{this.renderTimeUnits()}
						</select>
						<input type="radio" name="unit" defaultChecked="true" value="false" onChange={this.setTimeScale}>Seconds</input>
						<input type="radio" name="unit" value="true" onChange={this.setTimeScale}>Minutes</input>
						
						<input type="submit" value="save" />
						</form>
		);
	},
	buildTileNames(){
		return userTiles.map( (tile) =>
		<option value={tile.id}>{tile.name}</option>

		);
	},
	setSuccType(e){
		this.setState({succType:e.target.value});
	},
	setDeviceSelect(e){
		this.setState({deviceSelectSuccess: e.target.value});
	},
	setDeviceSelectFail(e){
		this.setState({deviceSelectFail: e.target.value});
	},
	render(){
		return (
				<li >{this.props.tileId}-{this.props.tileName}-{this.props.eventType}					
						
					{this.buildTimeSelector()}
					<OptionsWindow key={"success"+this.props.tileId} handleSubmit={this.handleSuccessSubmit}/>
					<OptionsWindow key={"fail"+this.props.tileId} handleSubmit={this.handleFailSubmit}/>
				</li>
		)
	}


});
var Recorder = React.createClass({
	getInitialState() {
		return {
        recording: false,
        singleAllowed: true,
        doubleAllowed: true,
        tiltAllowed: true,
        events: [],
		execs: []       
    }
	},

	componentDidMount() {
		socket.on('tileEvent', this.receiveEvent);
	},
	renderEvents(){
      return this.state.events.map((event, index) => (
		  <Event key={index} propKey={index} tileId={event.tileId} tileName={event.name} eventType={event.type} updateEvent={this.updateEvent} />
        
      ));
  },
  renderExecs(){
			return this.state.execs.map((exec, index) => (
        <Executor eventList={this.state.events} key={index} name={exec.name} />
      ));
  },
  setSingleFilter(){   
    this.setState({singleAllowed: !this.state.singleAllowed});
},
setDoubleFilter(){
    this.setState({doubleAllowed: !this.state.doubleAllowed});
},
setTiltFilter(){
    this.setState({tiltAllowed: !this.state.tiltAllowed});
},
startRecording(e){
this.state.recording ? this.setState({recording:false}) : this.setState({recording:true});
},
finishRecording(){
	this.setState({execs: this.state.execs.concat({name:"test"}), recording:false});
},
receiveEvent(msg){
    console.log(msg);
	var tileEvent = msg.event;
	var tileId = msg.tileId;
    if(this.state.recording){
        if(this.checkFilter(tileEvent)) this.addEvent(tileId,tileEvent)
    }

},
checkFilter(tileEvent){  
    if(tileEvent.properties[0] === "ta" && this.state.singleAllowed || 
    tileEvent.properties[0] === "doubleta" && this.state.doubleAllowed||
    tileEvent.properties[0] === "tile" && this.state.tiltAllowed){
        return true;    
}
    else return false;
},
addEvent(tileId,event){
console.log("event list before adding: "+this.state.events);
this.setState({events:this.state.events.concat({tileId:tileId,name:event.name, type:event.properties[0],  options:{timeLimit:0, terminId: false, terminTime: false,executeSuccess:null,executeFail:null}})});
},
updateEvent(id, options){
	console.log("in update event. event to be updated is ID "+id+" with options "+options.executeSuccess);
this.state.events[id].options = options;
this.setState({events:this.state.events});
},
	render(){
      return (
      <div className="body-container">
          
          <input type="button" onClick={this.startRecording.bind(this)} value="Record" />
                                             
            <input  type="checkbox" onChange={this.setSingleFilter.bind(this)} defaultChecked="checked" /> Single tap
            <input  type="checkbox" onChange={this.setDoubleFilter.bind(this)} defaultChecked="checked"  /> Double tap
            <input  type="checkbox" onChange={this.setTiltFilter.bind(this)} defaultChecked="checked"  /> Tilt
			<input type="button" onClick={this.finishRecording.bind(this)} value="Finish" />
            <ul>
                {this.renderEvents()}
            </ul>
            {this.state.recording && <div>we cording y'all</div>}
			{this.renderExecs()}

			
			
      </div>
      );
  }

});



React.render(<Recorder/>, document.getElementById('app'));