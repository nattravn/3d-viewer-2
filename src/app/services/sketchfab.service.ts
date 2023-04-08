import { Inject, Injectable } from '@angular/core';
//import Sketchfab2 from 'src/sketchfab-viewer-1.12.1';

import Sketchfab from '@sketchfab/viewer-api';
import { BehaviorSubject, Observable, of, ReplaySubject } from 'rxjs';
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

	private centerTarget = [0, 0, 0];

	//Public fields
	public cameraMoving = false;

	public spinning = false;

	public viewerready = false;

	public apiready$ = new ReplaySubject<boolean>(1);

	public lightStates$ = new ReplaySubject<Array<number[]>>(1);

	public lightStates: Array<number[]> = [];

	public texturQuality = "LD";


	private time = 0;

	private radius = 0;

	private initAngle = 0;

	private x = 0;

	private y = 0;

	private currentIframe: number;

	private zoomLimits: boolean;

	private camera = new Camera;

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
			success: (api: any) => this.onSuccess(api),
			error: (e: any) => this.onError(e),
		});

		this.client = client;
		return client;
	}

	public onSuccess(api: any) {
		this.api = api;

		this.apiready$.next(true);

		api.addEventListener('viewerready', () => {
			api.setTextureQuality('ld', () => {
				console.log('Texture quality set to low definition');
			});

			this._setCamera();

			const lightStates: Array<number[]> = [];

			for (let i = 0; i < 3; i++) {
				api.getLight(i, (err: unknown, state: []) => err ?
					() => { throw new Error(`Error: ${err}`); } :
					lightStates.push(state));
			}

			api.getEnvironment((err: any, state: any) => {
				if (!err) {
					lightStates.push(state);
				} else {
					console.log("Error: ", err);
					lightStates.push([0, 0, 0]);
				}
			});

			this.lightStates$.next(lightStates);
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

	//could either set this in meta data but it is simpler for the user to let the getCameraLookAt do on init instead
	// setting matrix in wordpress is not fun
	public _setCamera() {

		this.api.getCameraLookAt(async (err: any, camera: Camera) => {
			console.log("camera: ", camera);
			console.log('this.camera: ', this.camera);
			this.camera.positionInit = await camera.position;
			this.camera.targetInit = camera.target;
			console.log('this.camera: ', this.camera);

		});
	}

	public setLights(states: any[]) {
		console.log("states: ", states);
		for (let i = 0; i < 3; i++) {
			this.api.setLight(i, { matrix: states[i].matrix });
		}
		this.api.setEnvironment({ rotation: states[3].rotation });
	}

	public setInitCameraPos(useAnimationTime: boolean, currentIframe: number, cameraPositionInit: number[], cameraTargetInit: number[]) {
		this.currentIframe = currentIframe;
		this.zoomLimits = false;

		this.frames = 0.0;
		//if we changing model we dont want to use animation time, 0.0s instead
		const resetModelTime = (useAnimationTime ? this.resetModelTime : 0.1);

		this.api.setCameraLookAt(cameraPositionInit, cameraTargetInit, resetModelTime);
	}

	public setHDtexture(callback: any) {
		this.texturQuality = 'HD';
		this.api.setTextureQuality('hd', function(readyTexture: any) {
			console.log('Texture quality set to high definition');
			readyTexture = true;
			callback(readyTexture);
			return true;
		});
	}

	public setLDtexture(callback: any) {
		this.texturQuality = 'LD';
		this.api.setTextureQuality('ld', function(readyTexture: any) {
			console.log('Texture quality set to low definition');
			readyTexture = true;
			callback(readyTexture);
			return true;
		});
	}
}
