'use strict';

var React = require('react');
var moment = require('moment');
var socket = io.connect();
var execSoc = io.connect();

var userTiles = [];
socket.on('init', function (data) {
	userTiles = data;

});
var tileResponse = function (tileId, cmdString, param1, param2) {
	this.tileId = tileId;
	this.cmdString = cmdString;
	this.param1 = param1 ? param1 : null;
	this.param2 = param2 ? param2 : null;

	this.execute = function () {
		socket.emit("tileCmd", this);
	}
}

var Executor = React.createClass({
	getInitialState() {

		return {
			lastSuccessTime: null,
		}
	},
	componentDidMount() {
		execSoc.on('tileEvent', this.evaluate);
	},
	evaluate(msg) {
		var currIndex = this.props.currIndex;
		if (this.props.executing === true) {
			var tileEvent = msg.event;
			tileEvent.type = this.props.normalizeEventType(tileEvent.properties);
			var tileId = msg.tileId;
			var eventReceived = moment().valueOf();
			var currEvent = this.props.eventList[this.props.currIndex];

			var success = false;
			if (currEvent.tileId === tileId && currEvent.type === tileEvent.type) {
				success = true;


				if (currEvent.options.timeLimit && this.state.lastSuccessTime) {
					if (currEvent.options.timeLimit < (eventReceived - this.state.lastSuccessTime)) {

						success = false;
						if (currEvent.options.terminTime) this.terminate();
					}
				}
			}
			if (success) {

				this.props.sendResultSignal(this.props.currIndex, "success");
				if (currEvent.options.executeSuccess) {
					this.execute(currEvent.options.executeSuccess);
				}
				this.props.eventList.length !== this.props.currIndex ? this.setState({ lastSuccessTime: eventReceived }) : this.terminate();
			}
			else {
				if (currEvent.options.executeFail) {
					this.execute(currEvent.options.executeFail);
				}

				this.props.sendResultSignal(this.props.currIndex, "fail")
			}
		}
	},
	execute(ex) {
		ex.execute();
	},
	terminate() {
		this.props.resetEventStatuses();
		this.setState({ lastSuccessTime: null }); //reset our executor

	},
	render() {
		return (

			<div >
				{this.props.executing &&
					<div className="activate-btn" value="reset" onClick={this.terminate} >Reset </div>

				}
			</div>
		)

	}
});

var OptionsWindow = React.createClass(
	{
		getInitialState() {
			return {
				resType: "sTile",
				param2: false,
				editing: false
			}
		},
		setParam1(e) {
			e.target.dataset.has2param === "true" ? this.setState({ hasParam2: true, selectedParam1: e.target.value }) : this.setState({ hasParam2: false, selectedParam1: e.target.value })
		},
		setParam2(e) {
			this.setState({ selectedParam2: e.target.value });
		},
		setDeviceSelect(e) {
			this.setState({ deviceSelect: e.target.value });
		},
		setTileId(e) {
			this.setState({ selectedTileId: e.target.value })
		},
		setEditing() {
			this.setState({ editing: !this.state.editing });
		},
		resetResponses() {
			this.props.handleSubmit(null);
			this.setState({ selectedParam1: null, selectedParam2: null, deviceSelect: null, editing: false, param2: false });

		},
		buildTileNames() {
			return userTiles.map((tile) =>
				<option value={tile.id} selected={this.state.selectedTileId === tile.id ? true : false}>{tile.name}</option>

			);
		},
		handleTileSubmit(e) {
			e.preventDefault();
			var option2;
			if (this.state.selectedParam2) option2 = this.state.selectedParam2;
			var myResponse = new tileResponse(e.target.tileSelect.value, e.target.outputDevice.value, this.state.selectedParam1, option2);
			this.props.handleSubmit(myResponse);
			this.setEditing();
		},
		copyFromPrevious() {
			var previousExec = this.props.getPreviousExecution(this.props.type);

			if (previousExec && previousExec !== "error") {

				var param2 = previousExec.cmdString === "led" ? true : false;
				this.setState({ selectedTileId: previousExec.tileId, deviceSelect: previousExec.cmdString, selectedParam1: previousExec.param1, selectedParam2: previousExec.param2, hasParam2: param2 });
			}
			else {
				return console.log("error");
			}
		},
		buildDeviceSelect() {
			var devices = ["led", "haptic"];
			return devices.map((device) =>
				<option value={device} selected={this.state.deviceSelect === device ? true : false}>{device}</option>

			);
		},
		buildLedCommands() {
			var commands = [
				{ cmd: "on", icon: "http://res.cloudinary.com/deeron/image/upload/v1495405319/led_on_mlg5df.png", has2param: "true" },
				{ cmd: "off", icon: "http://res.cloudinary.com/deeron/image/upload/v1495405794/led_off_jpq2xd.png", has2param: "false" },
				{ cmd: "blink", icon: "http://res.cloudinary.com/deeron/image/upload/v1495405692/led_blink_b5qkhh.png", has2param: "true" },
				{ cmd: "fade", icon: "http://res.cloudinary.com/deeron/image/upload/v1495405793/led_fade_ffxjvh.png", has2param: "true" }
			];
			return commands.map((command) =>
				<label>
					<input type="radio" name="task-icon" ref={command.cmd} value={command.cmd} data-has2param={command.has2param} checked={this.state.selectedParam1 === command.cmd ? true : false} />
					<div className="img-container" >
						<img className="img-icon" src={command.icon} />
					</div>
				</label>
			);
		},
		buildHapticCommands() {
			var commands = [
				{ cmd: "long", icon: "http://res.cloudinary.com/deeron/image/upload/v1495406657/haptic_long_xusvag.png", has2param: "false" },
				{ cmd: "burst", icon: "http://res.cloudinary.com/deeron/image/upload/v1495406657/haptic_burst_eofhts.png", has2param: "false" }
			];
			return commands.map((command) =>
				<label>
					<input type="radio" name="task-icon" ref={command.cmd} value={command.cmd} data-has2param={command.has2param} checked={this.state.selectedParam1 === command.cmd ? true : false} />
					<div className="img-container" >
						<img className="img-icon" src={command.icon} />
					</div>
				</label>
			);
		},
		buildParam2() {
			var colors = ["white", "red", "blue", "green"];
			return colors.map((color) =>
				<label >
					<input type="radio" name="profile-color" ref={color} value={color} checked={this.state.selectedParam2 === color ? true : false} />
					<div className="color-circle" style={{ backgroundColor: color }} >

					</div>
				</label>
			);
		},
		buildForm() {
			if (this.state.resType === "sTile") {
				return (
					<form name="tileResponse" onSubmit={this.handleTileSubmit}>
						<label>Tile Name </label>
						<select name="tileSelect" onChange={this.setTileId}>
							{
								this.buildTileNames()
							}
						</select>

						<label>Output Device</label>
						<select name="outputDevice" onChange={this.setDeviceSelect} >
							<option >Choose Output</option>
							{this.buildDeviceSelect()}
						</select>

						{this.state.deviceSelect === "led" &&
							<div>
								<label name="commands">Command</label>
								<div className="icon-container" onChange={this.setParam1}>
									{this.buildLedCommands()}

								</div>


								{this.state.hasParam2 === true &&
									<div>
										<label name="commands">Command</label>
										<div className="color-container" onChange={this.setParam2}>
											{this.buildParam2()}
										</div>
									</div>
								}


							</div>}
						{this.state.deviceSelect === "haptic" &&
							<div>
								<div className="icon-container" onChange={this.setParam1}>
									{this.buildHapticCommands()}
								</div>
							</div>
						}
						<div className="submit-area">
							<input type="submit" value="Save" />
							<input type="button" value="Delete" onClick={this.resetResponses} />
						</div>
					</form>
				)
			}
		},
		render() {
			return (
				<div >
					<div className={"editing-buttons " + (this.state.editing ? "closed" : "open")}>
						<i className={"material-icons round " + (this.props.type === "success" ? " success" : " fail")} onClick={this.setEditing} >mode_edit</i> {this.props.type}
					</div>
					<div className={"modal-background" + (this.state.editing ? " open" : " closed")} onClick={this.setEditing} >
						me
					</div>
					<div className={"option-window modal " + (this.props.type === "success" ? " success" : " fail") + (this.state.editing ? " open" : " closed")}>

						<div>{this.props.type === "success" ? "On Success" : "On Fail"}</div>
						<select name="responseSelector" onChange={this.setResType}>

							<option value="sTile">Single Tile</option>
						</select>
						<i className="material-icons edit" ref="editResponse" onClick={this.copyFromPrevious}>content_copy</i>
						{this.state.editing &&
							this.buildForm()
						}

					</div>
				</div>

			);
		}
	}
);


var Event = React.createClass({
	getInitialState() {
		return {
			options: {
				timeLimit: null,
				terminId: false,
				terminTime: false,
				executeSuccess: null,
				executeFail: null
			},
			minutes: false,
			timeEditing: false
		}
	},
	renderTimeUnits() {
		var days = [];
		for (var i = 0; i <= 60; i++) {
			days.push(<option key={i}>{i}</option>);
		}

		return days;
	},
	getPreviousEventExecution(type) {
		if (this.props.propKey !== 0) {
			var previous = this.props.getPreviousEvent(this.props.propKey);
			if (previous.options) {
				return type === "success" ? previous.options.executeSuccess : previous.options.executeFail;
			}
		}
		else {
			return "error";
		}
	},
	setTimeScale(e) {

		this.setState({ minutes: e.currentTarget.value });
	},
	handleTimeSubmit(e) {
		e.preventDefault();

		var value = e.target.timeSelector.value * 1000;

		if (this.state.minutes) value *= 60;
		this.state.options.timeLimit = value;

		this.props.updateEvent(this.props.propKey, this.state.options);
		this.state.timeEditing = false;
		this.setState(this.state);

	},
	handleSuccessSubmit(res) {
		this.state.options.executeSuccess = res;
		this.props.updateEvent(this.props.propKey, this.state.options);
		this.setState(this.state);

	},
	handleFailSubmit(res) {
		this.state.options.executeFail = res;
		this.props.updateEvent(this.props.propKey, this.state.options);
		this.setState(this.state);

	},
	buildTimeSelector() {
		return (
			<div className={"option-window modal time" + ((this.state.timeEditing ? " open" : " closed"))}>
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
	buildTileNames() {
		return userTiles.map((tile) =>
			<option value={tile.id}>{tile.name}</option>

		);
	},
	setSuccType(e) {
		this.setState({ succType: e.target.value });
	},
	setDeviceSelect(e) {
		this.setState({ deviceSelectSuccess: e.target.value });
	},
	setDeviceSelectFail(e) {
		this.setState({ deviceSelectFail: e.target.value });
	},
	formatType() {
		if (this.props.eventType === "tilt") {
			return this.props.eventType
		}
		else if (this.props.eventType === "tapsingle") {
			return "Single Tap"
		}
		else {
			return "Double Tap"
		}
	},
	setInteractionClass(type) {
		if (type === "tapsingle") {
			return "tap"
		}
		else if (type === "tapdouble") {
			return "double-tap"
		}
		else {
			return "tilt"
		}
	},
	setEditing() {
		this.setState({ timeEditing: !this.state.timeEditing })
	},
	checkStatus() {
		if (this.props.status === "success") {
			return "connect-success"
		}
		else if (this.props.status === "fail") {
			return "connect-fail"
		}

	},
	deleteEvent() {
		this.props.deleteEvent(this.props.propKey);
	},
	render() {
		return (
			<li>
				<div className="equalHWrap eqWrap">
					<div className="equalHW eq ">
						<div className="name-area"><span onClick={this.deleteEvent}><i className="material-icons">delete</i></span> {this.props.tileName}</div>
					</div>
					<div className={"equalHW eq connect " + this.checkStatus()}>
						<div className={"node offset-left " + this.setInteractionClass(this.props.eventType)}>{this.formatType()}</div>
					</div>
					<div className="equalHW eq button-flex">

						<OptionsWindow key={"success" + this.props.tileId} handleSubmit={this.handleSuccessSubmit}
							getPreviousExecution={this.getPreviousEventExecution}
							type="success" />
						<OptionsWindow key={"fail" + this.props.tileId} handleSubmit={this.handleFailSubmit}
							getPreviousExecution={this.getPreviousEventExecution}
							type="fail" />
						<div>
							<div className={"editing-buttons " + (this.state.timeEditing ? "closed" : "open")}>
								<i className="material-icons round time" onClick={this.setEditing} >mode_edit</i> time window
						</div>
						</div>
						<div className={"modal-background" + (this.state.timeEditing ? " open" : " closed")} onClick={this.setEditing} >
							me
					</div>
						{this.buildTimeSelector()}


					</div>
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
			executing: false,
			currIndex: 0
		}
	},

	componentDidMount() {
		socket.on('tileEvent', this.receiveEvent);
	},
	renderEvents() {
		return this.state.events.map((event, index) => (
			<Event key={index} propKey={index} tileId={event.tileId} tileName={event.name} eventType={event.type}
				updateEvent={this.updateEvent}
				deleteEvent={this.deleteEvent}
				status={event.status}
				getPreviousEvent={this.getPreviousEvent} />

		));
	},
	renderExecs() {
		return (
			<Executor eventList={this.state.events}
				sendResultSignal={this.setEventStatus}
				resetEventStatuses={this.resetEventStatuses}
				executing={this.state.executing}
				stopExecuting={this.stopExecuting}
				currIndex={this.state.currIndex}
				normalizeEventType={this.normalizeEventType} />
		);
	},
	setSingleFilter() {
		this.setState({ singleAllowed: !this.state.singleAllowed });
	},
	setDoubleFilter() {
		this.setState({ doubleAllowed: !this.state.doubleAllowed });
	},
	setTiltFilter() {
		this.setState({ tiltAllowed: !this.state.tiltAllowed });
	},
	startRecording(e) {
		this.state.recording ? this.setState({ recording: false }) : this.setState({ recording: true });
	},
	stopExecuting() {

		this.setState({ executing: false, currIndex: 0 });
	},
	finishRecording() {
		this.resetEventStatuses();
		this.setState({ recording: false, executing: true });

	},
	normalizeEventType(properties) {
		if (properties[0] === "ta") {
			return "tapsingle"
		}
		else if (properties[0] === "doubleta") {
			return "tapdouble"
		}
		else {
			return properties.length > 1 ? properties[0] + properties[1] : properties[0]
		}
	},
	receiveEvent(msg) {


		var tileEvent = msg.event;
		var tileId = msg.tileId;
		tileEvent.type = this.normalizeEventType(tileEvent.properties);
		if (this.state.recording) {
			if (this.checkFilter(tileEvent)) this.addEvent(tileId, tileEvent)
		}

	},
	checkFilter(tileEvent) {
		if (tileEvent.type === "tapsingle" && this.state.singleAllowed ||
			tileEvent.type === "tapdouble" && this.state.doubleAllowed ||
			tileEvent.type === "tilt" && this.state.tiltAllowed) {
			return true;
		}
		else return false;
	},
	addEvent(tileId, event) {

		this.setState({ events: this.state.events.concat({ tileId: tileId, name: event.name, type: event.type, options: { timeLimit: 0, terminId: false, terminTime: false, executeSuccess: null, executeFail: null } }) });
	},
	updateEvent(id, options) {

		this.state.events[id].options = options;
		this.setState({ events: this.state.events });
	},
	setEventStatus(index, status) {
		this.state.events[index].status = status;
		if (status === "success") this.state.currIndex++;
		this.setState({ events: this.state.events, currIndex: this.state.currIndex });
	},

	resetEventStatuses() {
		for (var i = 0; i < this.state.events.length; i++) {
			if (this.state.events[i].status) {
				this.state.events[i].status = null;
			}
		}
		this.setState({ events: this.state.events, currIndex: 0, executing: false });
	},
	deleteEvent(index) {


		if (index < this.state.currIndex || index === this.state.events.length - 1) {
			this.state.currIndex--;
		}
		var result = this.state.events; //saving events here because you typically don't want to edit state like this directly
		result.splice(index, 1);
		this.setState({ events: result, currIndex: this.state.currIndex });
	},
	getPreviousEvent(index) {

		return this.state.events[index - 1];
	},
	render() {
		return (
			<div className="body-container">
				<div className="record-area">
					<div className="equalHWrap eqWrap">
						<div className="equalHW eq">
							<div className="filter-container">
								<input type="checkbox" onChange={this.setSingleFilter} defaultChecked="checked"> Single tap</input>
								<input type="checkbox" onChange={this.setDoubleFilter} defaultChecked="checked" /> Double tap
							<input type="checkbox" onChange={this.setTiltFilter} defaultChecked="checked" /> Tilt
				        </div>
						</div>
						<div className="equalHW eq">
							{this.state.executing === false ? <div type="button" onClick={this.startRecording} value="Record" className={"record " + (this.state.recording ? "active" : "")} > </div> :
								<div type="button" value="Record" className="record dark" > </div>
							}
						</div>
						<div className="equalHW eq">
							<div className="exec-buttons">

								{!this.state.executing &&
									<div className="activate-btn" onClick={this.finishRecording} value="Finish" >Activate</div>
								}
								<div className={this.props.executing ? "hidden" : ""}>

									{this.renderExecs()}
								</div>
							</div>
						</div>
					</div>
				</div>
				<div className="rec-node float-right">
					<ul>
						{this.renderEvents()}
					</ul>
				</div>
			</div>
		);
	}

});



React.render(<Recorder />, document.getElementById('app'));