import { Inject, Injectable } from '@angular/core';
//import Sketchfab2 from 'src/sketchfab-viewer-1.12.1';

import Sketchfab from '@sketchfab/viewer-api';
import { BehaviorSubject, debounceTime, delay, EMPTY, filter, finalize, interval, Observable, of, ReplaySubject, Subject, switchMap, take, takeWhile, tap } from 'rxjs';
import { Camera } from '../models/camera';

@Injectable()
export class SketchfabService {

	//// Private fields
	private animationTime = 0;

	private resetModelTime = 0;

	private spinVelocity = 0;

	private orbitPanFactor = 0;

	private orbitRotationFactor = 0;

	private orbitZoomFactor = 0;

	private logCamera = true;

	public api: any = null;

	public client: any = null;

	private frames = 0;

	//Public fields
	public cameraMoving = false;

	public spinning = false;

	public viewerready = false;

	public apiready$ = new ReplaySubject<boolean>(1);

	public lightStates$ = new ReplaySubject<Array<number[]>>(1);

	public lightStates: Array<number[]> = [];

	public texturQuality = "LD";

	public texturQuality$ = new BehaviorSubject<string>('LD');


	private time = 0;

	private radius = 0;

	private initAngle = 0;

	private x = 0;

	private y = 0;

	public camera = new Camera;

	private doneRotate = false;

	private doneRotate$ = new BehaviorSubject(false);

	// full circle
	private pi2 = 2.0 * Math.PI;

	// that needs to be a faction of PI
	private speedRotate = Math.PI / 50.0;

	private speed = 0.05;

	public timer = 0;

	public cameraIsMoving = false;

	private cameraIsMoving$ = new ReplaySubject<boolean>(1);

	public rootMatrixNodeId = null;

	constructor(
	) {
		this.apiready$.next(false);
	}

	public init(
		iframe: any,
		uid: any,
		annotationBounds: any,
		currentIframe: any,
	): any {
		// TODO this is async data, dont set it to this
		this.animationTime = annotationBounds.animationTime;
		this.resetModelTime = annotationBounds.resetModelTime;
		this.spinVelocity = annotationBounds.spinVelocity;
		this.orbitPanFactor = annotationBounds.orbitPanFactor;
		this.orbitRotationFactor = annotationBounds.orbitRotationFactor;
		this.orbitZoomFactor = annotationBounds.orbitZoomFactor;
		this.logCamera = annotationBounds.logCamera;

		// By default, the latest version of the viewer API will be used.
		const client = new Sketchfab(iframe);

		// https://github.com/sketchfab/experiments/blob/master/configurator/index.html

		// https://github.com/sketchfab/experiments/blob/master/compare-models/js/views/App.js

		this.viewerready = false;

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


			this.api.getCameraLookAt(async (err: any, camera: Camera) => {

				this.camera.positionInit = await camera.position;
				this.camera.targetInit = camera.target;

				this._onTick(this.camera.positionInit, this.camera.targetInit);
			});

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
				this.cameraIsMoving$.next(true);
				this.cameraIsMoving = true;
				this.doneRotate$.next(true);
			});

			api.addEventListener('camerastop', () =>{
				this.cameraMoving = false;
				this.doneRotate = false;
				this.cameraIsMoving = false;
				console.log("camera stop")
				this.doneRotate$.next(false);
				this.cameraIsMoving$.next(false);
				this.timer = 0;
			});

			// Can be removed later
			api.addEventListener('click', (info: any) => {
				console.log("info: ", info.instanceID);

				api.getNodeMap(function(err: any, nodes: any) {
					console.log("nodes: ", nodes)
				});
			});

			api.getRootMatrixNode((err: any, id: any, m: any ) => {
				// TODO set this in a better way
				if (!err) {
					this.rootMatrixNodeId = id;
				}
			});

			api.getMatrix(128, (err: any, matrix: any) => {
				if (!err) {
					window.console.log('Matrix:', matrix);
				}
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

		api.rotate(instanceID, [-addValue, 0, 1, 0], {
			duration: this.speed,
			easing: 'easeLinear',
		}, () => {
			//this.doneRotate = true;
			this.updateRotation((addValue + this.speedRotate), instanceID, api);
		});

	}

	private onError(e: any) {
		console.log('Viewer error', e);
	}

	public prevAnnotation(position: number[], target: number[], api: any) {

		api.setCameraLookAt(position, target, this.animationTime, () => {
			console.log('prev annotation');
		});

	}

	public nextAnnotation(position: number[], target: number[], api: any) {

		api.setCameraLookAt(position, target, this.animationTime, () => {
			console.log('next annotation');
		});
	}

	/**
	 * Probably delete this
	 * Runs un every frame update. The render loop
	 * The model will start to spin after some seconds of idle
	 */
	private _onTick(positionInit: any, targetInit: any) {
		// we dont always log camera position because of memory leak
		if (false) {
			this._updateCamera();
		}


		const onTick2 = () => {
			if (!this.cameraMoving) {
				this._rotateCamera(positionInit, targetInit);
			}

			requestAnimationFrame(onTick2);
		};

		onTick2();
	}

	// Probably delete this
	private _updateCamera() {
		this.api.getCameraLookAt((err: any, camera: any) => {
			this.camera = camera;
		});
	}

	// Probably delete this
	_rotateCamera(positionInit: any, targetInit: any) {
		this.time = (this.frames) * (Math.PI / 180); //xy plane;

		this.time = this.time * this.spinVelocity;

		this.radius = this.distance3d(positionInit, targetInit);

		this.initAngle = Math.acos(positionInit[0] / this.radius);

		this.x = this.radius * Math.cos(this.initAngle + this.time) + targetInit[0];
		this.y = this.radius * Math.sin(this.initAngle + this.time) + targetInit[1];

		this.frames++;

		// make the model spinn
		if (this.spinning) {
			this.api.lookat([this.x, this.y, positionInit[2]], targetInit, 0.00);
		}
	}

	/**
    * Private function
    */
	private distance3d(a: any, b: any) {
		return Math.sqrt(
			Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2) + Math.pow(a[2] - b[2], 2),
		);
	}

	//could either set this in meta data but it is simpler for the user to let the getCameraLookAt do on init instead
	// setting matrix in wordpress is not fun
	public _setCamera(api: any) {

		this.api.getCameraLookAt(async (err: any, camera: Camera) => {
			this.camera.positionInit = await camera.position;
			this.camera.targetInit = camera.target;
		});
	}

	public setLights(states: any[]) {
		for (let i = 0; i < 3; i++) {
			this.api.setLight(i, { matrix: states[i].matrix });
		}
		this.api.setEnvironment({ rotation: states[3].rotation });
	}

	public setInitCameraPos(useAnimationTime: boolean, currentIframe: number, cameraPositionInit: number[], cameraTargetInit: number[], api: any, readyToRotate: (err: any) => void) {
		//if we changing model we dont want to use animation time, 0.1s instead
		const resetModelTime = (useAnimationTime ? this.resetModelTime : 0.1);

		api.setCameraLookAt(cameraPositionInit, cameraTargetInit, resetModelTime, (err: any) => {
			if (!err) {
				// TODO fix dynamic rotation axis
				// Probably multiply with the node matrix here if the models pivot is rotated
				api.rotate(this.rootMatrixNodeId, [0, 0, 1, 0], {
					duration: 2,
					easing: 'easeLinear',
				}, () => {

					// Wait for camera to stop
					this.cameraIsMoving$.pipe(
						filter(cameraIsMoving => !cameraIsMoving),
						tap(() => {
							readyToRotate(false);
						}),
						takeWhile(cameraIsMoving => cameraIsMoving),
					).subscribe();
				});
			}
		});


	}

	public setHDtexture(callback: any) {
		this.texturQuality = 'HD';
		this.api.setTextureQuality('hd', (readyTexture: any) => {
			console.log('Texture quality set to high definition');
			readyTexture = true;
			this.texturQuality$.next('HD');
			callback(readyTexture);
			return true;
		});
	}

	public setLDtexture(callback: any) {
		this.texturQuality = 'LD';
		this.api.setTextureQuality('ld', (readyTexture: any) => {
			console.log('Texture quality set to low definition');
			readyTexture = true;
			this.texturQuality$.next('LD');
			callback(readyTexture);
			return true;
		});
	}
}
