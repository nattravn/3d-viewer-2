import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { WordpressService } from '../services/wordpress.service';
//import * as Sketchfab from 'src/sketchfab-viewer-1.12.1';
//import * as Sketchfab2 from '@sketchfab/viewer-api/index'
import { SketchfabService } from '../services/sketchfab.service';
import { BehaviorSubject, combineLatest, delay, filter, finalize, interval, map, Observable, of, ReplaySubject, Subject, Subscription, switchMap, take, takeUntil, takeWhile, tap } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WpPostModel } from '../models/wp-post.model';
import { PostMetaFields } from '../models/post-meta-fields';


@Component({
	selector: 'app-viewer',
	templateUrl: './viewer.component.html',
	styleUrls: ['./viewer.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerComponent implements OnInit {

	@ViewChild('postContainer') postContainer: ElementRef;

	@ViewChild('iframeContainer') iframeContainerRef: ElementRef;

	public readonly baseUrl = 'http://localhost:8080/wordpress/';

	// assigning the annotation data from wordpress to global variables
	private _descriptionsSwe: Array<string[]> = [];

	private _descriptionsEng: Array<string[]> = [];

	private _sweAnnotTitle: Array<string[]> = [];

	private _engAnnotTitle: Array<string[]> = [];

	private _helpTextSwe: string;

	private _helpTextEng: string;

	private _helpHeadingSwe: string;

	private _helpHeadingEng: string;

	private _spin_velocity: number;

	private _animationTime: number;

	private _resetModelTime: number;

	private _resetTime: number;

	private _menuScale: number;

	private _textboxScale: number;

	private _orbitPanFactor: number;

	private _orbitRotationFactor: number;

	private _orbitZoomFactor: number;

	private _logCamera: string;

	private _cameraPositions: Array<number[][]> = [];

	private _cameraTarget: Array<number[][]> = [];

	//private _viewers: Array<SketchfabService> = [];

	public viewersReady$: BehaviorSubject<string> = new BehaviorSubject<string>('Loading iframes');

	public allLoaded$ = new Subject<boolean>();

	public allLoaded = false;

	public infoBlockIsVisible = false;

	public selectedModel = 0;

	public nextModel = 0;

	public selectedAnnotation = 0;

	public sketchfabServices$: Array<Observable<SketchfabService>> = [];

	public selectedSketchfabService$ = new ReplaySubject<SketchfabService>(1);

	subscription: Subscription;

	private destroy$ = new Subject<void>();

	constructor(
		public wordpressService: WordpressService,
		public sketchfabService: SketchfabService,
		private changeDetector : ChangeDetectorRef,
		private sanitizer: DomSanitizer,
	) {

	}

	ngOnInit(): void {
		// https://stackblitz.com/edit/rxjs-5-progress-bar-wxdxwe?devtoolsheight=50&file=index.ts

		const sketchfabServices: Array<SketchfabService> = [];

		this.wordpressService.getPostsFromWp().pipe(
			delay(1),
			take(1),
			switchMap((posts: WpPostModel[]) => {

				posts.forEach((post, i) => {
					const sketchfabService = this.initWPpostData(post, i, sketchfabServices);
					this.sketchfabServices$.push(of(sketchfabService));
				});

				return combineLatest(
					this.sketchfabServices$,
				);
			}),
			switchMap(resolvedSketchfabServices => {
				const apireadyArray$: Array<Observable<boolean>> = [];

				console.log("sketchfabServices: ", sketchfabServices);
				resolvedSketchfabServices.forEach((sketchfabService) => {
					apireadyArray$.push(sketchfabService.apiready$);
				});

				return combineLatest(
					apireadyArray$,
				).pipe(
					filter((apireadyArray) => {
						return apireadyArray.every(elem => elem) ? true : false;
					}),
					map(() => sketchfabServices),
				);
			}),
			takeUntil(this.allLoaded$),
			switchMap((viewers: SketchfabService[]) => {
				// start next viewer after the previous ar done (serially)
				this.viewersReady$.next(`Models loading: 0/${viewers.length} loaded`);
				viewers[0].api.start();
				viewers[0].setHDtexture((readyTexture: any) => { });

				this.selectedSketchfabService$.next(viewers[0]);
				viewers.forEach((viewer: any, i: number)=> {
					viewer.api.addEventListener('viewerready', () => {
						//viewer.api.start();
						if (i < viewers.length - 1) {
							this.viewersReady$.next(`Models loading: ${i + 1}/${viewers.length} loaded`);
							viewers[i + 1].api.start();
						} else {
							console.log("all done");
							this.allLoaded = true;
							this.allLoaded$.next(true);
							this.allLoaded$.complete();
							this.viewersReady$.next(`Models loading: ${i + 1}/${viewers.length} loaded`);
						}
					});
				});
				return of(false);

			}),
			finalize(() => {
				console.log("all done");
			}),
		).subscribe();

		// Do the spinning
		interval(1000).pipe(
			takeUntil(this.destroy$),
			switchMap(() => this.selectedSketchfabService$),
			map(selectedSketchfabService => {
				if (!selectedSketchfabService.cameraIsMoving && selectedSketchfabService.timer > 10) {
					selectedSketchfabService.setLights(selectedSketchfabService.lightStates);

					selectedSketchfabService.setInitCameraPos(true, 0, selectedSketchfabService.camera.positionInit, selectedSketchfabService.camera.targetInit, selectedSketchfabService.api, (err: boolean) => {
						console.log("error: ", err);
						if (!err) {
							console.log("start rotating");
							selectedSketchfabService.updateRotation(0, selectedSketchfabService.rootMatrixNodeId, selectedSketchfabService.api);
						}
					});

					//setTimeout(() => {
					//	selectedSketchfabService.updateRotation(0, selectedSketchfabService.rootMatrixNodeId, selectedSketchfabService.api);
					//}, 5 * 1000 + 2000); // reset time for setInitCameraPos (reset view (5s) and rotate to init position (2s))
				} else {
					// Do nothing
				}
				selectedSketchfabService.timer++;
				return selectedSketchfabService.timer;
			}),
		).subscribe();
	}

	ngOnDestroy() {
		this.subscription.unsubscribe();
		this.destroy$.next();
   		this.destroy$.complete();
	}

	private initWPpostData(post: WpPostModel, index: number, sketchfabServices: SketchfabService[]): SketchfabService {
		// assigning the annotation data from wordpress to global variables

		this._descriptionsSwe.push(post.post_meta_fields.swe_description);
		this._descriptionsEng.push(post.post_meta_fields.eng_description);
		this._sweAnnotTitle.push(post.post_meta_fields.swe_title);
		this._engAnnotTitle.push(post.post_meta_fields.eng_title);

		const div = document.createElement('div');
		div.innerHTML = post.content.rendered.trim();

		const uid = post.post_meta_fields.model_id;

		// Todo target this in a better way
		this._helpTextSwe = post.post_meta_fields.swe_help_text;
		this._helpTextEng = post.post_meta_fields.eng_help_text;
		this._helpHeadingSwe = post.post_meta_fields.swe_help_heading;
		this._helpHeadingEng = post.post_meta_fields.eng_help_heading;

		this._spin_velocity = post.post_meta_fields.spin_velocity;
		this._animationTime = post.post_meta_fields.animation_time;
		this._resetModelTime = post.post_meta_fields.reset_model_time;
		this._resetTime = post.post_meta_fields.reset_time;
		this._menuScale = post.post_meta_fields.menu_scale;
		this._textboxScale = post.post_meta_fields.textbox_scale;
		this._orbitPanFactor = post.post_meta_fields.orbit_pan_factor;
		this._orbitRotationFactor = post.post_meta_fields.orbit_rotation_factor;
		this._orbitZoomFactor = post.post_meta_fields.orbit_zoom_factor;
		this._logCamera = post.post_meta_fields.log_camera;

		this._cameraPositions.push(post.post_meta_fields.camera_position);
		this._cameraTarget.push(post.post_meta_fields.camera_target);

		//new annotation
		const annotationBounds = {
			animationTime: post.post_meta_fields.animation_time,
			resetModelTime: post.post_meta_fields.reset_model_time,
			cameraPosition: this._cameraPositions[index],
			cameraTarget: this._cameraTarget[index],
			spinVelocity: post.post_meta_fields.spin_velocity,
			orbitPanFactor: post.post_meta_fields.orbit_pan_factor,
			orbitRotationFactor: post.post_meta_fields.orbit_rotation_factor,
			orbitZoomFactor: post.post_meta_fields.orbit_zoom_factor,
			logCamera: post.post_meta_fields.log_camera,
		};

		sketchfabServices.push(new SketchfabService());

		const iframe = document.getElementById(`api-frame-${post.id}`);

		if (iframe) {
			const client = sketchfabServices[index].init(iframe, uid, annotationBounds, 0);
		}

		return sketchfabServices[index];
	}

	public selectModel(selectedModel: number, postId: number, sketchfabServicePrev: SketchfabService, sketchfabServiceNext: SketchfabService) {

		console.log("iframeContainerRef: ", this.iframeContainerRef.nativeElement);

		const iframeWrapper = this.iframeContainerRef.nativeElement.querySelector(`#api-frame-wrapper-${postId}`);

		//const viewer = document.getElementById(`api-frame-${postId}`);

		// append loading bar for texture-loading
		const loading = document.createElement('div');
		const loadTextureLayer = document.createElement('div');

		loading.className = 'spinner';
		loadTextureLayer.className = 'load-texture-layer';

		console.log("iframe: ", iframeWrapper);
		console.log("selectedModel: ", postId);
		if (iframeWrapper) {
			//iframeWrapper.appendChild(loading);
			//iframeWrapper.appendChild(loadTextureLayer);
		}

		this.selectedAnnotation = 0;

		sketchfabServicePrev.setLDtexture((readyTexture: any) => {
			// remove loading bar and loadTextureLayer
			if (readyTexture) {
				//TODO fix lag, the repositioning should happens after the texture is set
				sketchfabServicePrev.setInitCameraPos(true, 0, sketchfabServicePrev.camera.positionInit, sketchfabServicePrev.camera.targetInit, sketchfabServicePrev.api, () => { });
			}
		});

		this.selectedModel = selectedModel;
		this.selectedSketchfabService$.next(sketchfabServiceNext);

		sketchfabServiceNext.setHDtexture((readyTexture: any) => {
			// remove loading bar and loadTextureLayer
			if (readyTexture) {
				setTimeout(()=>{
					if (iframeWrapper) {
						//iframeWrapper.removeChild(loading);
						//iframeWrapper.removeChild(loadTextureLayer);
					}
				}, 1000);
			}
		});
	}

	public showInfoBlock(infoBlockIsVisible: boolean): void {
		this.infoBlockIsVisible = infoBlockIsVisible ? false : true;
	}

	public previousAnnotation(selectedModel: number, post_meta_fields: PostMetaFields, sketchfabService: SketchfabService): void {
		if (this.selectedAnnotation > 0) {
			this.selectedAnnotation--;
		}
		sketchfabService.nextAnnotation(post_meta_fields.camera_position[this.selectedAnnotation], post_meta_fields.camera_target[this.selectedAnnotation], sketchfabService.api);
	}

	public nextAnnotation(postsLength: number, selectedModel: number, post_meta_fields: PostMetaFields, sketchfabService: SketchfabService): void {
		if (!sketchfabService) {
			return;
		}

		if (this.selectedAnnotation < postsLength) {
			this.selectedAnnotation++;
		}
		sketchfabService.nextAnnotation(
			post_meta_fields.camera_position[this.selectedAnnotation],
			post_meta_fields.camera_target[this.selectedAnnotation],
			sketchfabService.api,
		);
	}


	public resetModel(selectedModel: number, modelChanged: boolean, lightStates: Array<number[]> | null, sketchfabService: SketchfabService) {
		console.log('lightStates: ', lightStates);
		console.log('sketchfabService.camera.positionInit: ', sketchfabService.camera.positionInit);
		if (!lightStates) {
			return;
		}
		this.selectedAnnotation = 0;
		// firstAnnotation(_currentAnnotation);

		// _currentModelElm = document.getElementById(_currentModel);

		// // if user just want to reset the cam, modelChange is false
		// if(!modelChanged ){
		// 	_viewers[_currentModel].spinning = false;
		// }
		// if(_currentModelElm.contains(_standbyLayers[_currentModel]) && !modelChanged){
		// 	ctrl.currentIframeElm = document.getElementById(_currentModel);
		// 	ctrl.currentIframeElm.removeChild(_standbyLayers[_currentModel]);
		// }

		// reset light positions

		sketchfabService.setLights(lightStates);

		// if modelChanged is true use animation time

		sketchfabService.setInitCameraPos(true, selectedModel, sketchfabService.camera.positionInit, sketchfabService.camera.targetInit, sketchfabService.api, () => { });
	}

	/**
	 * Wait for element to be rendered in template
	 * @param selector
	 * @returns
	 */
	private waitForElm(selector: any) {
		return new Promise(resolve => {
			if (document.querySelector(selector)) {
				return resolve(document.querySelector(selector));
			}

			const observer = new MutationObserver(() => {
				if (document.querySelector(selector)) {
					resolve(document.querySelector(selector));
					observer.disconnect();
				}
			});

			observer.observe(document.body, {
				childList: true,
				subtree: true,
			});
		});
	}
}
