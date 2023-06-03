import { ChangeDetectionStrategy,  Component, ElementRef, OnInit, QueryList, Renderer2, ViewChildren } from '@angular/core';
import { WordpressService } from '../services/wordpress.service';
import { SketchfabService } from '../services/sketchfab.service';
import { BehaviorSubject, combineLatest, delay, filter, finalize, interval, map, Observable, of, ReplaySubject, Subject, switchMap, take, takeUntil, tap } from 'rxjs';
import { WpPostModel } from '../models/wp-post.model';
import { InfoBox } from '../models/info-box-content.model';
import { Annotation } from '../models/annotation.model';
import { SketchFabModelData } from '../models/sketchfab-model-data';


@Component({
	selector: 'app-viewer',
	templateUrl: './viewer.component.html',
	styleUrls: ['./viewer.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerComponent implements OnInit {

	/** Get handle on cmp tags in the template */
	@ViewChildren('viewerRef') viewerRef:QueryList<ElementRef>;

	public readonly baseUrl = 'http://localhost:8080/wordpress/';

	public annotationDescription$ = new ReplaySubject<string>(1);

	public annotationTitle$ = new ReplaySubject<string>(1);

	public helpInfoHeading$ = new ReplaySubject<string>(1);

	public helpInfoText$ = new ReplaySubject<string>(1);

	public showClickableLayer$ = new ReplaySubject<boolean>(1);

	public selectedLanguage$ = new BehaviorSubject<'swedish' | 'english'>('english');

	public viewersReady$: BehaviorSubject<string> = new BehaviorSubject<string>('Loading iframes');

	public allLoaded$ = new Subject<boolean>();

	// Replay subject instead??
	public infoBlockIsVisible = false;

	public annotationBlockIsVisible = false;

	public selectedAnnotation = 0;

	public selectedSketchfabService$ = new ReplaySubject<SketchfabService>(1);

	private startSpinningInterval$ = new BehaviorSubject<boolean>(true);

	public sketchfabServices$: Observable<SketchfabService[]>;

	/**
	 * Subject to to complete subscriptions on destroy.
	 */
	private untilDestroyed$ = new Subject<boolean>();

	constructor(
		public wordpressService: WordpressService,
		public sketchfabService: SketchfabService,
		private renderer: Renderer2,
		private el: ElementRef,
	) {}

	ngOnInit(): void {
		// https://stackblitz.com/edit/rxjs-5-progress-bar-wxdxwe?devtoolsheight=50&file=index.ts

		this.sketchfabServices$ = this.wordpressService.getPostsFromWp().pipe(
			takeUntil(this.untilDestroyed$),
			delay(1),
			take(1),
			switchMap((posts: WpPostModel[]) => {
				const sketchfabServices$: Array<Observable<SketchfabService>> = [];

				posts.forEach((post, i) => {
					const sketchfabService = this.initWPpostData(post, i);
					sketchfabServices$.push(of(sketchfabService));
				});

				return combineLatest(
					sketchfabServices$,
				);
			}),
			switchMap(resolvedSketchfabServices => {
				const apireadyArray$: Array<Observable<boolean>> = [];

				resolvedSketchfabServices.forEach((sketchfabService) => {
					apireadyArray$.push(sketchfabService.apiready$);
				});
				return combineLatest(
					apireadyArray$,
				).pipe(
					filter((apireadyArray) => {
						return apireadyArray.every(elem => elem) ? true : false;
					}),
					map(() => resolvedSketchfabServices),
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
							this.allLoaded$.next(true);
							this.allLoaded$.complete();
							this.viewersReady$.next(`Models loading: ${i + 1}/${viewers.length} loaded`);
						}
					});
				});
				return of(viewers);

			}),
			finalize(() => {
				console.log("all done");
			}),
		);

		// Do the spinning
		interval(1000).pipe(
			takeUntil(this.untilDestroyed$),
			switchMap(() => this.startSpinningInterval$),
			filter(destroy => destroy),
			switchMap(() => this.selectedSketchfabService$),
			switchMap(selectedSketchfabService => {
				//console.log("cameraIsMoving: ", selectedSketchfabService.cameraIsMoving)
				//console.log("selectedSketchfabService.spinning: ", selectedSketchfabService.spinning)
				if (!selectedSketchfabService.cameraIsMoving && selectedSketchfabService.timer % 10 == 0 && selectedSketchfabService.timer > 10) {
					// FIXME selectedSketchfabService.lightStates is only loaded after some seconds
					selectedSketchfabService.setLights(selectedSketchfabService.lightStates);
					this.startSpinningInterval$.next(false);


					return selectedSketchfabService.setInitCameraPos(0, selectedSketchfabService.annotations[0].cameraPosition, selectedSketchfabService.annotations[0].cameraTarget, selectedSketchfabService.api, selectedSketchfabService.resetModelTime).pipe(
						delay(selectedSketchfabService.resetModelTime * 1000 + 1000),
						map(() => {
							// Most reset frame after init position otherwise the first spinning frame will show an already rotated model
							selectedSketchfabService.frames = 0.0;
							selectedSketchfabService.spinning = true;
							this.showClickableLayer$.next(true);

							this.startSpinningInterval$.next(true);
							return selectedSketchfabService;

						}),
					);
				} else {
					return of(selectedSketchfabService);
				}

			}),
			tap((selectedSketchfabService) => {
				selectedSketchfabService.timer++;
			}),
		).subscribe();
	}

	ngOnDestroy() {
		this.startSpinningInterval$.next(false);
   		this.startSpinningInterval$.complete();

		this.untilDestroyed$.next(true);
		this.untilDestroyed$.complete();
	}

	private initWPpostData(post: WpPostModel, index: number): SketchfabService {

		// assigning the annotation data from wordpress to global variables
		const annotations = new Array<Annotation>;
		const helpInfo = new InfoBox('', '', '', '');

		post.post_meta_fields.swe_description.forEach((sweDescription, i) => {
			annotations.push({
				cameraPosition: post.post_meta_fields.camera_position[i],
				cameraTarget: post.post_meta_fields.camera_target[i],
				english: {
					description: post.post_meta_fields.eng_description[i],
					heading: post.post_meta_fields.eng_title[i],
				},
				swedish: {
					description: sweDescription,
					heading: post.post_meta_fields.swe_title[i],
				},
			});
		});

		helpInfo.english.heading = post.post_meta_fields.eng_help_heading;
		helpInfo.english.description = post.post_meta_fields.eng_help_text;
		helpInfo.swedish.heading = post.post_meta_fields.swe_help_heading;
		helpInfo.swedish.description = post.post_meta_fields.swe_help_text;

		//new annotation
		const sketchFabModelData: SketchFabModelData = {
			animationTime: post.post_meta_fields.animation_time,
			resetModelTime: post.post_meta_fields.reset_model_time,
			spinVelocity: post.post_meta_fields.spin_velocity,
			orbitPanFactor: post.post_meta_fields.orbit_pan_factor,
			orbitRotationFactor: post.post_meta_fields.orbit_rotation_factor,
			orbitZoomFactor: post.post_meta_fields.orbit_zoom_factor,
			logCamera: post.post_meta_fields.log_camera,
			rotAxis: post.post_meta_fields.rot_axis,
			imageUrl: post.post_meta_fields.image_url,
			annotations: annotations,
			helpInfo: helpInfo,
			slug: post.slug,
			modelIndex: index,
		};

		const iframe = this.viewerRef.get(index)?.nativeElement;

		const sketchfabServices = new SketchfabService();

		if (iframe) {
			sketchfabServices.init(iframe, post.post_meta_fields.model_id, sketchFabModelData, 0);
		} else {
			console.error('iframe element is: ', iframe);
		}

		return sketchfabServices;
	}

	public selectModel(sketchfabServicePrev: SketchfabService, sketchfabServiceNext: SketchfabService, selectedLanguage: 'swedish' | 'english') {
		sketchfabServicePrev.spinning = false;

		if (sketchfabServiceNext.modelIndex != null) {
			this.viewerRef.get(sketchfabServiceNext.modelIndex)?.nativeElement.scrollIntoView();
		}

		sketchfabServicePrev.setLDtexture((readyTexture: any) => {
			// remove loading bar and loadTextureLayer
			if (readyTexture) {
				sketchfabServicePrev.setInitCameraPos(0, sketchfabServicePrev.annotations[0].cameraPosition, sketchfabServicePrev.annotations[0].cameraTarget, sketchfabServicePrev.api, 0.01).pipe(
					delay(sketchfabServicePrev.resetModelTime),
					tap(() => {
						sketchfabServicePrev.cameraIsMoving = false;
						this.startSpinningInterval$.next(true);

					}),
				);
			}
		});

		this.selectedSketchfabService$.next(sketchfabServiceNext);

		sketchfabServiceNext.setHDtexture((readyTexture: any) => {
			// remove loading bar and loadTextureLayer
			if (readyTexture) {
				console.log('Texture loaded hd');
			}
		});

		this.annotationDescription$.next(sketchfabServiceNext.annotations[0][selectedLanguage].description);
		this.annotationTitle$.next(sketchfabServiceNext.annotations[0][selectedLanguage].heading);
	}

	public showAnnotationBlock(annotationBlockIsVisible: boolean, selectedSketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english'): void {
		this.annotationDescription$.next(selectedSketchfabService.annotations[this.selectedAnnotation][selectedLanguage].description);
		this.annotationTitle$.next(selectedSketchfabService.annotations[this.selectedAnnotation][selectedLanguage].heading);
		this.annotationBlockIsVisible = annotationBlockIsVisible ? false : true;
		this.infoBlockIsVisible = false;
	}

	public showInfoBlock(infoBlockIsVisible: boolean, selectedSketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english') {
		this.helpInfoHeading$.next(selectedSketchfabService.helpInfo[selectedLanguage].heading);
		this.helpInfoText$.next(selectedSketchfabService.helpInfo[selectedLanguage].description);
		this.infoBlockIsVisible = infoBlockIsVisible ? false : true;
		this.annotationBlockIsVisible = false;
	}

	public previousAnnotation(sketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english'): void {
		if (this.selectedAnnotation > 0) {
			this.selectedAnnotation--;
		}

		sketchfabService.nextAnnotation(
			sketchfabService.annotations[this.selectedAnnotation].cameraPosition,
			sketchfabService.annotations[this.selectedAnnotation].cameraTarget,
			sketchfabService.api,
		);

		this.annotationDescription$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].description);
		this.annotationTitle$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].heading);
	}

	public nextAnnotation(sketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english'): void {
		if (!sketchfabService) {
			return;
		}

		if (this.selectedAnnotation < sketchfabService.annotations.length) {
			this.selectedAnnotation++;
		}

		sketchfabService.nextAnnotation(
			sketchfabService.annotations[this.selectedAnnotation].cameraPosition,
			sketchfabService.annotations[this.selectedAnnotation].cameraTarget,
			sketchfabService.api,
		);

		this.annotationDescription$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].description);
		this.annotationTitle$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].heading);
	}

	public resetModel$(lightStates: Array<number[]> | null, sketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english'): Observable<string> {
		sketchfabService.spinning = false;
		if (!lightStates) {
			return of('message1');
		}
		this.selectedAnnotation = 0;

		// reset light positions
		if (lightStates.length) {
			sketchfabService.setLights(lightStates);
		}
		this.annotationDescription$.next(sketchfabService.annotations[0][selectedLanguage].description);
		this.annotationTitle$.next(sketchfabService.annotations[0][selectedLanguage].heading);

		return sketchfabService.setInitCameraPos(0, sketchfabService.annotations[0].cameraPosition, sketchfabService.annotations[0].cameraTarget, sketchfabService.api, sketchfabService.resetModelTime).pipe(
			delay(sketchfabService.resetModelTime * 1000),
			tap(() => {
				sketchfabService.cameraIsMoving = false;
				this.startSpinningInterval$.next(true);
				return 'message2';
			}),
		);
	}

	public toggleLanguage(annotations: any, selectedLanguage: 'swedish' | 'english', selectedAnnotation: number) {
		this.annotationDescription$.next(annotations.descriptions[selectedAnnotation]);
		this.annotationTitle$.next(annotations.titles[selectedAnnotation]);

		this.selectedLanguage$.next(selectedLanguage);
	}

	public stopSpinning(spinningElement: any, sketchfabService: SketchfabService) {
		sketchfabService.spinning = false;
		this.showClickableLayer$.next(false);
		sketchfabService.cameraIsMoving = false;
		console.log('spinningElement: ', spinningElement);
	}
}
