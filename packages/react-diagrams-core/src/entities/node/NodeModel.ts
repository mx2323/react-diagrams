import * as _ from 'lodash';
import { DiagramEngine } from '../../DiagramEngine';
import { DiagramModel } from '../../models/DiagramModel';
import { PortModel } from '../port/PortModel';
import { LinkModel } from '../link/LinkModel';
import { Point } from '@projectstorm/geometry';
import {
	BaseEntityEvent,
	BaseModelListener,
	BasePositionModel,
	BasePositionModelGenerics
} from '@projectstorm/react-canvas-core';

export interface NodeModelListener extends BaseModelListener {
	positionChanged?(event: BaseEntityEvent<NodeModel>): void;
}

export interface NodeModelGenerics extends BasePositionModelGenerics {
	LISTENER: NodeModelListener;
	PARENT: DiagramModel;
}

export class NodeModel<G extends NodeModelGenerics = NodeModelGenerics> extends BasePositionModel<G> {
	protected ports: { [s: string]: PortModel };

	// calculated post rendering so routing can be done correctly
	width: number;
	height: number;

	constructor(options: G['OPTIONS']) {
		super(options);
		this.ports = {};
		this.width = 0;
		this.height = 0;
	}

	setPosition(point: Point);
	setPosition(x: number, y: number);
	setPosition(x, y?) {
		let old = this.position;
		super.setPosition(x, y);

		// also update the port co-ordinates (for make glorious speed)
		_.forEach(this.ports, port => {
			port.setPosition(port.getX() + x - old.x, port.getY() + y - old.y);
		});
	}

	getSelectedEntities() {
		let entities = super.getSelectedEntities();

		// add the points of each link that are selected here
		if (this.isSelected()) {
			_.forEach(this.ports, port => {
				entities = entities.concat(
					_.map(port.getLinks(), link => {
						return link.getPointForPort(port);
					})
				);
			});
		}
		return entities;
	}

	deserialize(ob: ReturnType<this['serialize']>, engine: DiagramEngine) {
		super.deserialize(ob, engine);

		//deserialize ports
		_.forEach(ob.ports, (port: any) => {
			let portOb = engine.getFactoryForPort(port.type).generateModel({});
			portOb.deserialize(port, engine);
			this.addPort(portOb);
		});
	}

	serialize() {
		return {
			...super.serialize(),
			ports: _.map(this.ports, port => {
				return port.serialize();
			})
		};
	}

	doClone(lookupTable = {}, clone) {
		// also clone the ports
		clone.ports = {};
		_.forEach(this.ports, port => {
			clone.addPort(port.clone(lookupTable));
		});
	}

	remove() {
		super.remove();
		_.forEach(this.ports, port => {
			_.forEach(port.getLinks(), link => {
				link.remove();
			});
		});
	}

	getPortFromID(id): PortModel | null {
		for (var i in this.ports) {
			if (this.ports[i].getID() === id) {
				return this.ports[i];
			}
		}
		return null;
	}

	getLink(id: string): LinkModel {
		for (let portID in this.ports) {
			const links = this.ports[portID].getLinks();
			if (links[id]) {
				return links[id];
			}
		}
	}

	getPort(name: string): PortModel | null {
		return this.ports[name];
	}

	getPorts(): { [s: string]: PortModel } {
		return this.ports;
	}

	removePort(port: PortModel) {
		// clear the port from the links
		for (let link of _.values(port.getLinks())) {
			link.clearPort(port);
		}
		//clear the parent node reference
		if (this.ports[port.getName()]) {
			this.ports[port.getName()].setParent(null);
			delete this.ports[port.getName()];
		}
	}

	addPort(port: PortModel): PortModel {
		port.setParent(this);
		this.ports[port.getName()] = port;
		return port;
	}

	updateDimensions({ width, height }: { width: number; height: number }) {
		this.width = width;
		this.height = height;
	}
}