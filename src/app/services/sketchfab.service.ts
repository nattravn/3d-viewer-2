import { Injectable } from '@angular/core';
//import Sketchfab2 from 'src/sketchfab-viewer-1.12.1';

import Sketchfab from '@sketchfab/viewer-api';
import { BehaviorSubject, delay, filter, map, Observable, of, ReplaySubject, Subject, takeWhile, tap } from 'rxjs';
import { Camera } from '../models/camera.model';
import { InfoBox, InfoBoxContent } from '../models/info-box-content.model';
import { Annotation } from '../models/annotation.model';
import { SketchFabModelData } from '../models/sketchfab-model-data';
import { Point } from '../models/point.model';

@Injectable()
export class SketchfabService {

	//Public fields
	public api: any = null;

	public client: any = null;

	public modelIndex: number | undefined;

	public apiready$ = new ReplaySubject<boolean>(1);

	public lightStates$ = new ReplaySubject<Array<number[]>>(1);

	public lightStates: Array<number[]> = [];

	public textureQuality$ = new BehaviorSubject<string>('LD');

	public timer = 0;

	public cameraIsMoving = false;

	public cameraIsMoving$ = new BehaviorSubject(false);

	public annotations: Array<Annotation>;

	public helpInfo = new InfoBox('', '', '', '');

	public spinning = false;

	public frames = 0;

	public imageUrl = '';

	public slug: string;

	public changingAnnotation$ = new Subject<boolean>();

	//// Private fields
	public animationTime = 0;

	public resetModelTime = 0;

	private spinVelocity = 0;

	private orbitPanFactor = 0;

	private orbitRotationFactor = 0;

	private orbitZoomFactor = 0;

	private logCamera = true;

	private rotAxis = { x:0, y:0, z:0 };

	private time = 0;

	private radius = 0;

	private initAngle = 0;

	private x = 0;

	private y = 0;

	private z = 0;

	private camera = new Camera;

	private doneRotate = false;

	// full circle
	private pi2 = 2.0 * Math.PI;

	// that needs to be a faction of PI
	private speedRotate = Math.PI / 50.0;

	private speed = 0.05;

	//TODO try to remove 'this' variables
	constructor(sketchFabModelData: SketchFabModelData) {
		this.animationTime = sketchFabModelData.animationTime;
		this.resetModelTime = sketchFabModelData.resetModelTime;
		this.spinVelocity = sketchFabModelData.spinVelocity;
		this.orbitPanFactor = sketchFabModelData.orbitPanFactor;
		this.orbitRotationFactor = sketchFabModelData.orbitRotationFactor;
		this.orbitZoomFactor = sketchFabModelData.orbitZoomFactor;
		this.logCamera = sketchFabModelData.logCamera;
		this.rotAxis = sketchFabModelData.rotAxis;
		this.annotations = sketchFabModelData.annotations;
		this.helpInfo = sketchFabModelData.helpInfo;
		this.modelIndex = sketchFabModelData.modelIndex;
		this.imageUrl = sketchFabModelData.imageUrl;
		this.slug = sketchFabModelData.slug;

		this.apiready$.next(false);
	}

	public init(
		iframe: any,
		uid: any,
		currentIframe: any,
	): any {
		// TODO this is async data, dont set it to this


		this.camera.positionInit = this.annotations[0].cameraPosition;
		this.camera.targetInit = this.annotations[0].cameraTarget;

		// By default, the latest version of the viewer API will be used.
		const client = new Sketchfab(iframe);

		// https://github.com/sketchfab/experiments/blob/master/configurator/index.html

		// https://github.com/sketchfab/experiments/blob/master/compare-models/js/views/App.js


		// Alternatively, you can request a specific version.
		// var client = new Sketchfab( '1.12.1', iframe );

		client.init(uid, {
			transparent: 0,
			annotations_visible: 0,
			preload: 0,
			autospin: 0,
			ui_infos: 0,
			ui_stop: 0,
			ui_annotations: 0,
			ui_fullscreen: 0,
			ui_help: 0,
			ui_vr: 0,
			ui_inspector: 0,
			ui_settings: 0,
			ui_hint: 0,
			autostart: 0,
			watermark: 0,
			ui_watermark_link: 0,
			orbit_pan_factor: this.orbitPanFactor,
			orbit_rotation_factor:this.orbitRotationFactor,
			orbit_zoom_factor: this.orbitZoomFactor,
			camera: 0,
			success: (api: any) => this.onSuccess(api, iframe),
			error: (e: any) => this.onError(e),
		});

		this.client = client;
		return client;
	}

	public onSuccess(api: any, iframe: any) {
		this.api = api;

		this.apiready$.next(true);

		api.addEventListener('viewerready', () => {
			api.setTextureQuality('ld', () => {
				console.log('Texture quality set to low definition');
			});

			this._onTick(api, this.annotations[0].cameraPosition, this.annotations[0].cameraTarget, this.rotAxis);

			const lightStates: Array<number[]> = [];

			for (let i = 0; i < 3; i++) {
				api.getLight(i, (err: unknown, state: []) => {
					if (!err) {
						this.lightStates.push(state);
						this.lightStates$.next(lightStates);
					} else {
						throw new Error(`Error: ${err}`);
					}
				});
			}

			api.getEnvironment((err: any, state: any) => {
				if (!err) {
					this.lightStates.push(state);
					console.log('state: ', state);
					this.lightStates$.next(lightStates);
				} else {
					lightStates.push([0, 0, 0]);
					throw new Error(`Error: ${err}`);
				}
				console.log('lightStates: ', lightStates);
			});

			api.addEventListener('camerastart', () => {
				this.doneRotate = true;
				//this.cameraIsMoving$.next(true);
				this.cameraIsMoving = true;
				//console.log('camerastart')
			});

			api.addEventListener('camerastop', () =>{
				this.doneRotate = false;
				this.cameraIsMoving = false;
				//console.log('camerastop')
				//this.cameraIsMoving$.next(false);
				this.timer = 0;
			});

			// Can be removed later
			api.addEventListener('click', (info: any) => {
				console.log("info: ", info.instanceID);

				api.getNodeMap(function(err: any, nodes: any) {
					console.log("nodes: ", nodes)
				});
			});

			api.addEventListener('click', () => {
				this._onClick(this.camera);
			});
		});
	}

	public updateRotation(addValue: any, instanceID: any, api: any) {

		this.cameraIsMoving = true;
		if (this.doneRotate) return;
		//this.doneRotate = false;

		// make sure values doesn't go beyond full circle
		if (addValue >= this.pi2) {
			addValue = addValue - this.pi2;
		}

		api.rotate(instanceID, [-addValue, this.rotAxis.x, this.rotAxis.y, this.rotAxis.z], {
			duration: this.speed,
			easing: 'linear',
		}, () => {
			//this.doneRotate = true;
			this.updateRotation((addValue + this.speedRotate), instanceID, api);
		});
	}

	private onError(e: any) {
		console.log('Viewer error', e);
	}

	public changeAnnotation(position: number[], target: number[], animationTime: number, api: any): Observable<boolean> {
		this.changingAnnotation$.next(true);
		return new Observable<boolean>((observer) => {
			api.setCameraLookAt(position, target, animationTime, () => {
				this.cameraIsMoving = true;
			});
			observer.next(true);
			observer.complete();
		}).pipe(
			// Only to disable the button 1 second
			delay(1000),
		);
	}

	/**
	 * Runs un every frame update. The render loop
	 * The model will start to spin after some seconds of idle
	 */
	private _onTick(api: any, positionInit: any, targetInit: any, rotAxis: Point) {
		// we dont always log camera position because of memory leak
		if (this.logCamera) {
			//this._updateCamera();
		}

		this._rotateCamera(api, positionInit, targetInit, rotAxis);

		// Request the next animation frame
		requestAnimationFrame(() => this._onTick(api, positionInit, targetInit, rotAxis));
	}

	//when the user click in the 3d space, hide both annotations, descriptions and dropdownmenu
	private _onClick(camera: any) {
		this.spinning = false;
		this.cameraIsMoving = false;
		this.api.getCameraLookAt((err: any, camera: any) => {
			console.log("camera: ", camera);
			const posX = camera.position[0].toFixed(3);
			const posY = camera.position[1].toFixed(3);
			const posZ = camera.position[2].toFixed(3);

			const targX = camera.target[0].toFixed(3);
			const targY = camera.target[1].toFixed(3);
			const targZ = camera.target[2].toFixed(3);
			console.log("camera.position: ", posX, " ", posY, " ", posZ);
			console.log("camera.target: ", targX, " ", targY, " ", targZ);
		});
		//console.clear()
	}

	// Probably delete this
	private _updateCamera() {
		this.api.getCameraLookAt((err: any, camera: any) => {
			return camera;
		});
	}

	// Function to rotate the camera around
	_rotateCamera(api: any, positionInit: any, targetInit: any, rot_axis: { x:number, y:number, z:number }) {
		this.time = this.frames * (Math.PI / 180); // Convert frames to radians

		this.time = this.time * this.spinVelocity;

		this.radius = this.distance3d(positionInit, targetInit);

		// {x(t),y(t)}={rcosθ,rsinθ}
		// Determine which axis to rotate around (initiated in the wp-post)
		if (rot_axis.x > 0) {
			// Does not rotate around the axis correctly
			// Might depends on the models orbit transformation or how the camera targetInit coordinates was set
			this.initAngle = Math.acos(positionInit[1] / this.radius);
			this.x = positionInit[0];
			this.y = this.radius * Math.cos(this.initAngle + this.time) + targetInit[0];
			this.z = this.radius * Math.sin(this.initAngle + this.time) + targetInit[2]; // Rotates camera from helmet to feet
		} else if (rot_axis.y > 0) {
			this.initAngle = Math.acos(positionInit[0] / this.radius);
			this.x = this.radius * Math.cos(this.initAngle + this.time) + targetInit[1];
			this.y = positionInit[1];
			this.z = this.radius * Math.sin(this.initAngle + this.time) + targetInit[2];
		} else {
			// Default y-axis rotation
			this.initAngle = Math.acos(positionInit[0] / this.radius);
			this.x = this.radius * Math.cos(this.initAngle + this.time) + targetInit[0]; // rotates camera from left to right arm of the model
			this.y = this.radius * Math.sin(this.initAngle + this.time) + targetInit[1]; // moves camera forward and backwards on the z-axis
			this.z = positionInit[2];
		}

		this.frames++;

		// make the model spinn
		if (this.spinning) {
			this.cameraIsMoving = true;
			//[eye], [target], animation
			api.lookat([this.x, this.y, this.z], targetInit, 0.00);
		}
	}

	/**
    * Private function
    */
	private distance3d(pointA: Array<number>, pointB: Array<number>) {
		const dx = pointB[0] - pointA[0];
		const dy = pointB[1] - pointA[1];
		const dz = pointB[2] - pointA[2];

		return Math.sqrt(dx * dx + dy * dy + dz * dz);
	}

	//could either set this in meta data but it is simpler for the user to let the getCameraLookAt do on init instead
	// setting matrix in wordpress is not fun
	public _setCamera(api: any) {

		this.api.getCameraLookAt(async (err: any, camera: Camera) => {
			this.camera.positionInit = await camera.position;
			this.camera.targetInit = camera.target;
		});
	}

	public setLights(api: any, states: any[]) {
		for (let i = 0; i < 3; i++) {
			api.setLight(i, { matrix: states[i].matrix });
		}
		api.setEnvironment({ rotation: states[3].rotation });
	}

	public setInitCameraPos(currentIframe: number, cameraPositionInit: number[], cameraTargetInit: number[], api: any, resetModelTime: number): Observable<string> {
		this.frames = 0.0; // To reset the frames, otherwise an old frame will be rendered when user select the model next time
		this.timer = 0; // Reset the timer
		this.cameraIsMoving = false;
		this.changingAnnotation$.next(true);
		return new Observable<string>((observer) =>
			api.setCameraLookAt(cameraPositionInit, cameraTargetInit, resetModelTime, (err: any) => {
				if (!err) {
					observer.next('debug');
				} else {
					observer.next('debug');
				}
				observer.complete();
				return of('debug');
			}),
		);

	}

	public setHDtexture(api: any): Observable<boolean> {
		return new Observable<boolean>((observer) =>
			api.setTextureQuality('hd', (readyTexture: any) => {
				console.log('Texture quality set to high definition');
				this.textureQuality$.next('HD');
				observer.next(true);
				observer.complete();
			}),
		);
	}

	public setLDtexture(api: any): Observable<boolean> {
		return new Observable<boolean>((observer) =>
			api.setTextureQuality('ld', (readyTexture: any) => {
				console.log('Texture quality set to low definition');
				this.textureQuality$.next('LD');
				observer.next(true);
				observer.complete();
			}),
		);
	}
}
