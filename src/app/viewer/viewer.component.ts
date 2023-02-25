import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { WordpressService } from '../services/wordpress.service';
//import * as Sketchfab from 'src/sketchfab-viewer-1.12.1';
//import * as Sketchfab2 from '@sketchfab/viewer-api/index'
import { SketchfabService } from '../services/sketchfab.service';
import { combineLatest, delay, filter, Observable, of, ReplaySubject, switchMap } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { WpModel } from '../models/wp-model';


@Component({
	selector: 'app-viewer',
	templateUrl: './viewer.component.html',
	styleUrls: ['./viewer.component.css'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerComponent implements OnInit {

	@ViewChild('postContainer') postContainer: ElementRef;

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

	safeHtml: SafeHtml;

	private _viewers: Array<SketchfabService> = [];


	constructor(
		public wordpressService: WordpressService,
		public sketchfabService: SketchfabService,
		private changeDetector : ChangeDetectorRef,
		private sanitizer: DomSanitizer,
	) {

	}

	ngOnInit(): void {
		// https://stackblitz.com/edit/rxjs-5-progress-bar-wxdxwe?devtoolsheight=50&file=index.ts
		const sketchfabServiceArray$: Array<Observable<SketchfabService> | ReplaySubject<boolean>> = [];

		this.wordpressService.getPosts().pipe(
			delay(1),
			switchMap((posts: WpModel[]) => {
				posts.forEach((post, i) => {
					const sketchfabService = this.initWPpostData(post, i);
					sketchfabServiceArray$.push(of(sketchfabService));
					sketchfabServiceArray$.push(sketchfabService.apiready$);
				});

				return combineLatest(
					sketchfabServiceArray$,
				).pipe(
					filter((apiStatesAndServices) => {
						// Wait foe api to be ready
						const continue1: Array<boolean> = [];
						apiStatesAndServices.forEach(apiStatesAndService => !!apiStatesAndService ? continue1.push(true) : []);

						if (continue1.length == apiStatesAndServices.length && continue1.every(elem => elem === true)) {
							return true;
						} else {
							return false;
						}
					}),
					switchMap(apiStatesAndServices => {
						// Remove apiready from array
						const viewers = apiStatesAndServices.filter((e: any) => typeof e  !== 'boolean');
						return of(viewers);
					}),
				);
			}),
			switchMap((viewers: any) => {
				// start next viewer after the prevous ar done (serially)
				viewers[0].api2.start();
				viewers.forEach((viewer: any, i: number)=> {
					viewer.api2.addEventListener( 'viewerready', () => {
						viewer.api2.start();
						if (i < viewers.length - 1 ) {
							viewers[i + 1].api2.start();
						}
					});
				});

				return viewers;
			}),
		).subscribe(x => {
			console.log('x: ', x)
		});

	}

	private initWPpostData(post: any, index: number): SketchfabService {
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
			animationTime: this._animationTime,
			resetModelTime: this._resetModelTime,
			cameraPosition: this._cameraPositions[index],
			cameraTarget: this._cameraTarget[index],
			spinVelocity: this._spin_velocity,
			orbitPanFactor: this._orbitPanFactor,
			orbitRotationFactor: this._orbitRotationFactor,
			orbitZoomFactor: this._orbitZoomFactor,
			logCamera: this._logCamera,
		};

		const iframe = document.getElementById(`api-frame-${post.id}`);


		this._viewers.push(new SketchfabService());
		const c = this._viewers[index].init(iframe, uid, annotationBounds, 0);

		return this._viewers[index];
	}

	public test() {
		console.log("log")
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
