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
       
		eventList: events,
		lastSuccessTime: null,
		currIndex:0
		
              
    }
	},
	componentDidMount() {
		execSoc.on('tileEvent', this.evaluate);
	},
	evaluate(msg){
		console.log("in evaluate, here is curr event in event list");
		console.log(this.state.eventList);
		console.log(this.props.eventList);
		
		if(this.props.active){
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
					this.props.sendResultSignal(this.state.currIndex,"success");
				if(this.state.eventList[0].options.executeSuccess){
					this.execute(this.state.eventList[0].options.executeSuccess);
				}
				//remove event from list
				currEventList.shift();
				
				console.log("events left length: "+currEventList.length)
				
				currEventList.length > 0 ? this.setState({eventList: currEventList, lastSuccessTime: eventReceived, currIndex: this.state.currIndex+1 }) : this.terminate();
			}
		else {
			if(this.state.eventList[0].options.executeFail){
			this.execute(this.state.eventList[0].options.executeFail);
		}
		
			this.props.sendResultSignal(this.state.currIndex,"fail")
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
		this.props.resetEventStatuses();
		this.props.stopExecuting();
		this.setState({eventList:this.props.eventList.slice(0), lastSuccessTime:null, currIndex:0}); //reset our executor
	},
	render(){
		return (
			
		<div>
			{this.props.active && 
			<input type="button" value="reset" onClick={this.terminate} />
			
			}

		</div>
		)
	}
});

var OptionsWindow = React.createClass(
	{
		getInitialState(){
			return {
				resType:"sTile",
				param2:false,
				editing:false
			}
		},
		setResType(e){
			
		},
		setParam1(e){
			
		console.log(event.target.value);
		console.log(e.target.dataset.has2param);


			e.target.dataset.has2param === "true"? this.setState({hasParam2:true, selectedParam1:e.target.value}) : this.setState({hasParam2:false, selectedParam1:e.target.value}) 
		},
		setParam2(e){
			
		console.log(event.target.value);
		console.log(e.target.dataset.has2param);


			this.setState({selectedParam2:e.target.value});
		},
		setDeviceSelect(e){
		this.setState({deviceSelect: e.target.value});
		},
		setEditing(){
			this.setState({editing:!this.state.editing});
		},
		resetResponses(){
			this.props.handleSubmit(null);
			this.setState({selectedParam1:null, selectedParam2:null,deviceSelect:null,editing:false,param2:false});

		},
		buildTileNames(){
			return userTiles.map( (tile) =>
			<option value={tile.id}>{tile.name}</option>

			);
		},
		handleTileSubmit(e){
			e.preventDefault();
			var option2;
			if(this.state.selectedParam2) option2 = this.state.selectedParam2;
			var myResponse = new tileResponse(e.target.tileSelect.value,e.target.outputDevice.value,this.state.selectedParam1,option2);
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
						
						{this.state.deviceSelect === "led" &&
						<div>
							<label name="commands">Command</label>
							<div className="icon-container" onChange={this.setParam1}>
								<label  >
        						<input type="radio" name="task-icon" ref="on" value="on" data-has2param="true"   />
        						<div className="img-container" >
         						 <img className="img-icon" src="http://res.cloudinary.com/deeron/image/upload/v1495405319/led_on_mlg5df.png" />
       							 </div>
      							</label>
								  <label  >
        						<input type="radio" name="task-icon" ref="off" value="off" data-has2param="false"  />
        						<div className="img-container" >
         						 <img className="img-icon" src="http://res.cloudinary.com/deeron/image/upload/v1495405794/led_off_jpq2xd.png" />
       							 </div>
      							</label>
								  <label  >
        						<input type="radio" name="task-icon" ref="blink" value="blink" data-has2param="true"  />
        						<div className="img-container" >
         						 <img className="img-icon" src="http://res.cloudinary.com/deeron/image/upload/v1495405692/led_blink_b5qkhh.png" />
       							 </div>
      							</label>
								  <label  >
        						<input type="radio" name="task-icon" ref="fade" value="fade" data-has2param="true"  />
        						<div className="img-container" >
         						 <img className="img-icon" src="http://res.cloudinary.com/deeron/image/upload/v1495405793/led_fade_ffxjvh.png" />
       							 </div>
      							</label>
								
							</div>
						
						{console.log("Just before option 2, param2 in state is "+this.state.param2)}
						{this.state.hasParam2  === true &&
						<div>
						<label name="commands">Command</label>
							<div className="color-container" onChange={this.setParam2}>
								<label >
								<input type="radio" name="profile-color" ref="color1" value="white"  />
								<div className="color-circle" style={{backgroundColor:"white"}} >

								</div>
								</label>
									<label >
								<input type="radio" name="profile-color" ref="color1" value="red"  />
								<div className="color-circle" style={{backgroundColor:"red"}} >

								</div>
								</label>
									<label >
								<input type="radio" name="profile-color" ref="color1" value="blue"  />
								<div className="color-circle" style={{backgroundColor:"blue"}} >

								</div>
								</label>
									<label >
								<input type="radio" name="profile-color" ref="color1" value="green"  />
								<div className="color-circle" style={{backgroundColor:"green"}} >

								</div>
								</label>
              				</div>

							  </div>


						
						
						}
						
						
						</div>}
						{this.state.deviceSelect === "haptic" &&
					<div>
						<div className="icon-container" onChange={this.setParam1}>
								<label  >
        						<input type="radio" name="task-icon" ref="long" value="long" data-has2param="false"  />
        						<div className="img-container" >
         						 <img className="img-icon" src="http://res.cloudinary.com/deeron/image/upload/v1495406657/haptic_long_xusvag.png" />
       							 </div>
      							</label>
								  <label  >
        						<input type="radio" name="task-icon" ref="burst" value="burst" data-has2param="false"  />
        						<div className="img-container" >
         						 <img className="img-icon" src="http://res.cloudinary.com/deeron/image/upload/v1495406657/haptic_burst_eofhts.png" />
       							 </div>
      							</label>
								  
								
							</div>						
					</div>
						}
						<div className="submit-area">
						<input type="submit" value="Save" />
						<input type="button" value="Delete" onClick={this.resetResponses}/>
						</div>
					</form>
				)
			}
		},
		render(){
			return (
			<div className={"option-window "+(this.props.type === "success" ? "success":"fail")}>
				<div>{this.props.type === "success" ? "On Success":"On Fail"}</div>
				<select name="responseSelector" onChange={this.setResType}>
					
					<option value="sTile">Single Tile</option>
				</select>
				<i className="material-icons edit" ref="editResponse" onClick={this.setEditing}>mode_edit</i>
				{this.state.editing &&
				this.buildForm()
				}
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
			<div className="option-window time">
			<form name="setTime" onSubmit={this.handleTimeSubmit}>
			<label>Set event time window</label>
						<select name="timeSelector">
							{this.renderTimeUnits()}
						</select>
						<input type="radio" name="unit" defaultChecked="true" value="false" onChange={this.setTimeScale}>Seconds</input>
						<input type="radio" name="unit" value="true" onChange={this.setTimeScale}>Minutes</input>
						
						<input type="submit" value="save" />
						</form>
			</div>
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
	setInteractionClass(type){
		if(type === "ta"){
			return "tap"
		}
		else if(type === "doubleta"){
			return "double-tap"
		}
		else{
			return "tilt"
		}
	}, //{this.props.tileId}-{this.props.tileName}-{this.props.eventType}	
	checkStatus(){
		if(this.props.status === "success"){
			return "connect-success"
		}
		else if(this.props.status === "fail"){
			return "connect-fail"
		}
		
	},
	render(){
		return (
				<li>
					<div className="equalHWrap eqWrap">
						<div className="equalHW eq ">
							<div className="name-area">{this.props.tileName}</div>
						</div>
						<div className={"equalHW eq connect "+this.checkStatus()}>
							<div className={"node offset-left "+this.setInteractionClass()}>{this.props.eventType}</div>
						</div>
						<div className="equalHW eq button-flex">
						<div className="option-window-area">
							<OptionsWindow key={"success"+this.props.tileId} handleSubmit={this.handleSuccessSubmit} type="success"/>
						<OptionsWindow key={"fail"+this.props.tileId} handleSubmit={this.handleFailSubmit} type="fail"/>
						{this.buildTimeSelector()}
						</div>
							
						</div>	
					</div>
					<div style={{display:"none"}}>
						
						<OptionsWindow key={"success"+this.props.tileId} handleSubmit={this.handleSuccessSubmit} type="success"/>
						<OptionsWindow key={"fail"+this.props.tileId} handleSubmit={this.handleFailSubmit} type="fail"/>
						</div>
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
		execs: [],
		executing:false      
    }
	},

	componentDidMount() {
		socket.on('tileEvent', this.receiveEvent);
	},
	renderEvents(){
      return this.state.events.map((event, index) => (
		  <Event key={index} propKey={index} tileId={event.tileId} tileName={event.name} eventType={event.type} updateEvent={this.updateEvent} status={event.status} />
        
      ));
  },
  renderExecs(){
			return this.state.execs.map((exec, index) => (
        <Executor eventList={this.state.events} key={index} name={exec.name} sendResultSignal={this.setEventStatus} resetEventStatuses={this.resetEventStatuses} active={this.state.executing} stopExecuting={this.stopExecuting}/>
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
stopExecuting(){
	
	this.setState({executing:false});
},
finishRecording(){
	this.resetEventStatuses();
	if(!this.state.execs.length){
	this.setState({execs: this.state.execs.concat({name:"test"}), recording:false, executing:true});
	
}
else{
	this.setState({ recording:false, executing:true});
}

},
receiveEvent(msg){
    console.log(msg);
	var tileEvent = msg.event;
	var tileId = msg.tileId;
	var eventType = tileEvent.properties[0]+tileEvent.properties[1];
    if(this.state.recording){
        if(this.checkFilter(tileEvent)) this.addEvent(tileId,tileEvent)
    }

},
checkFilter(tileEvent){  
    if(tileEvent.properties[0] === "ta" && this.state.singleAllowed || 
    tileEvent.properties[0] === "doubleta" && this.state.doubleAllowed||
    tileEvent.properties[0] === "tilt" && this.state.tiltAllowed){
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
setEventStatus(index,status){
this.state.events[index].status = status;
this.setState({events:this.state.events});
},
resetEventStatuses(){
for(var i =0; i<this.state.events.length;i++){
	if(this.state.events[i].status){
		this.state.events[i].status = null;
	}
}
this.setState({events:this.state.events});
},
	render(){
      return (
      <div className="body-container">
          
          
            <div className="record-area">       

				<div className="equalHWrap eqWrap">
					<div className="equalHW eq">
						<div className="filter-container">
							<input  type="checkbox" onChange={this.setSingleFilter.bind(this)} defaultChecked="checked"> Single tap</input>
							<input  type="checkbox" onChange={this.setDoubleFilter.bind(this)} defaultChecked="checked"  /> Double tap
							<input  type="checkbox" onChange={this.setTiltFilter.bind(this)} defaultChecked="checked"  /> Tilt
				        </div>
					</div>
					<div className="equalHW eq">
							<div type="button" onClick={this.startRecording.bind(this)} value="Record" className={"record "+(this.state.recording ? "active":"")} > </div>   
					</div>
					<div className="equalHW eq">
						<input type="button" onClick={this.finishRecording.bind(this)} value="Finish" />
						<div className="exec-area">
					{this.renderExecs()}
			</div>
					</div>
				</div>  
			</div>
			<div className="rec-node float-right">
					<ul>
						{this.renderEvents()}
					</ul>
					
					{this.state.recording && <div>we cording y'all</div>}
			</div>
			
      </div>
      );
  }

});



React.render(<Recorder/>, document.getElementById('app'));