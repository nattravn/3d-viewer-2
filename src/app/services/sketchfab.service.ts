import { Inject, Injectable } from '@angular/core';
//import Sketchfab2 from 'src/sketchfab-viewer-1.12.1';

import Sketchfab from '@sketchfab/viewer-api';
import { BehaviorSubject, Observable, of, ReplaySubject } from 'rxjs';

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

	public api2: any = null;
	public client: any = null;

	private frames = 0;
	private centerTarget = [0,0,0];
	private cameraPositionInit = [0,0,0];
	private cameraTargetCurrentInit = [0,0,0];
	private cameraTargetCurrent = [0,0,0];

	//Public fields
	public cameraMoving = false;
	public spinning = false;
	public viewerready = false;

	public apiready$ = new ReplaySubject<boolean>(1);

	public lightStates = [];
	public texturQuality = "LD";


	private time = 0;
	private radius = 0;
	private initAngle = 0;
	private x = 0;
	private y = 0;

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
		this.animationTime = annotationBounds.animationTime;
		this.resetModelTime = annotationBounds.resetModelTime;
		this.spinVelocity = annotationBounds.spinVelocity;
		this.orbitPanFactor = annotationBounds.orbitPanFactor;
		this.orbitRotationFactor = annotationBounds.orbitRotationFactor;
		this.orbitZoomFactor = annotationBounds.orbitZoomFactor;
		this.logCamera = annotationBounds.logCamera;

		// By default, the latest version of the viewer API will be used.
		const client = new Sketchfab( iframe );

		// https://github.com/sketchfab/experiments/blob/master/configurator/index.html

		// https://github.com/sketchfab/experiments/blob/master/compare-models/js/views/App.js

		this.viewerready = false;

		// Alternatively, you can request a specific version.
		// var client = new Sketchfab( '1.12.1', iframe );

		client.init( uid, {
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
		//api.start();
		this.api2 = api;
		this.apiready$.next(true);
		// return api.addEventListener( 'viewerready', () => {

		// 	this.viewerready$.next(true);
		// 	// API is ready to use
		// 	// Insert your code here
		// 	console.log( 'Viewer is ready' );

		// 	this.viewerready = true;
		// 	return of(true);
		// });
	}

	private onError(e: any) {
		console.log( 'Viewer error', e );
	}
}
