import { ChangeDetectionStrategy,  Component, ElementRef, OnInit, QueryList, Renderer2, ViewChildren } from '@angular/core';
import { WordpressService } from '../services/wordpress.service';
import { SketchfabService } from '../services/sketchfab.service';
import { BehaviorSubject, combineLatest, delay, filter, finalize, interval, map, Observable, of, ReplaySubject, Subject, switchMap, take, takeUntil, takeWhile, tap } from 'rxjs';
import { WpPostModel } from '../models/wp-post.model';
import { InfoBox, InfoBoxContent } from '../models/info-box-content.model';
import { Annotation } from '../models/annotation.model';
import { SketchFabModelData } from '../models/sketchfab-model-data';
import { HttpClient } from '@angular/common/http';


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

	public annotationHeading$ = new ReplaySubject<string>(1);

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

	private readonly intervalStep = 5;

	/**
	 * Subject to to complete subscriptions on destroy.
	 */
	private untilDestroyed$ = new Subject<boolean>();

	constructor(
		public wordpressService: WordpressService,
		public sketchfabService: SketchfabService,

		private https: HttpClient,
	) {}

	ngOnInit(): void {
		// https://stackblitz.com/edit/rxjs-5-progress-bar-wxdxwe?devtoolsheight=50&file=index.ts



		const url = 'https://cdn.softube.com/api/v1/products?pageSize=1000';

    	const data =  this.https.get<any>(url).subscribe();

		console.log('data: ', data);

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
				// Should this be included in the chain instead?
				viewers[0].api.start();

				// TODO Not working texture will still be LD, must update the frame in some way
				 return viewers[0].setHDtexture(viewers[0].api).pipe(
					filter(texture => texture),
					switchMap(() => {
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
				 );
			}),
			finalize(() => {
				console.log("all done");
			}),
		);

		// Do the spinning
		interval(1000).pipe(
			takeUntil(this.untilDestroyed$),
			switchMap(() => this.startSpinningInterval$),
			filter(startSpinningInterval => startSpinningInterval),
			switchMap(() => this.selectedSketchfabService$),
			switchMap(selectedSketchfabService => {
				console.log('selectedSketchfabService.cameraIsMoving: ', selectedSketchfabService.cameraIsMoving);
				if (!selectedSketchfabService.cameraIsMoving && selectedSketchfabService.timer % this.intervalStep == 0 && selectedSketchfabService.timer > this.intervalStep) {
					// FIXME selectedSketchfabService.lightStates is only loaded after some seconds
					selectedSketchfabService.setLights(selectedSketchfabService.api, selectedSketchfabService.lightStates);
					this.startSpinningInterval$.next(false);
					this.infoBlockIsVisible = false;
					this.annotationBlockIsVisible = false;
					this.selectedAnnotation = 0;

					return selectedSketchfabService.setInitCameraPos(
						0,
						selectedSketchfabService.annotations[0].cameraPosition,
						selectedSketchfabService.annotations[0].cameraTarget,
						selectedSketchfabService.api,
						selectedSketchfabService.resetModelTime,
					).pipe(
						delay(selectedSketchfabService.resetModelTime * 1000 + 1000),
						map(() => {
							//Camera can be in moving mode here if user have clicked on next annotation. The spinning should be ignored then
							if (!selectedSketchfabService.cameraIsMoving) {
								// Most reset frame after init position otherwise the first spinning frame will show an already rotated model
								selectedSketchfabService.frames = 0.0;
								selectedSketchfabService.spinning = true;
								this.showClickableLayer$.next(true);
							}
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

		const annotations = new Array<Annotation>;

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

		const helpInfo = new InfoBox(
			post.post_meta_fields.eng_help_text,
			post.post_meta_fields.eng_help_heading,
			post.post_meta_fields.swe_help_text,
			post.post_meta_fields.swe_help_heading,
		);

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

		console.log('sketchFabModelData: ', sketchFabModelData)
		const sketchfabServices = new SketchfabService(sketchFabModelData);

		if (iframe) {
			sketchfabServices.init(iframe, post.post_meta_fields.model_id, 0);
		} else {
			console.error('iframe element is: ', iframe);
		}

		return sketchfabServices;
	}

	public selectModel$(sketchfabServicePrev: SketchfabService, sketchfabServiceNext: SketchfabService, selectedLanguage: 'swedish' | 'english'): Observable<boolean> {
		sketchfabServicePrev.spinning = false;

		if (sketchfabServiceNext.modelIndex != null) {
			this.viewerRef.get(sketchfabServiceNext.modelIndex)?.nativeElement.scrollIntoView();
		}

		return sketchfabServicePrev.setLDtexture(sketchfabServicePrev.api).pipe(
			takeUntil(this.untilDestroyed$),
			filter(texture => texture),
			switchMap(() => {
				return sketchfabServicePrev.setInitCameraPos(0, sketchfabServicePrev.annotations[0].cameraPosition, sketchfabServicePrev.annotations[0].cameraTarget, sketchfabServicePrev.api, 0.01).pipe(
					delay(sketchfabServicePrev.resetModelTime),
					switchMap(() => {
						sketchfabServicePrev.cameraIsMoving = false;
						this.startSpinningInterval$.next(true);
						this.selectedSketchfabService$.next(sketchfabServiceNext);

						return sketchfabServiceNext.setHDtexture(sketchfabServiceNext.api).pipe(
							filter(texture => texture),
							tap(() => {
								console.log('Texture loaded hd');
								this.annotationDescription$.next(sketchfabServiceNext.annotations[0][selectedLanguage].description);
								this.annotationHeading$.next(sketchfabServiceNext.annotations[0][selectedLanguage].heading);

								return true;
							}),
						);

					}),
				);
			}),
		);
	}

	public showAnnotationBlock(annotationBlockIsVisible: boolean, selectedSketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english'): void {
		//this.stopSpinning(selectedSketchfabService);
		this.annotationDescription$.next(selectedSketchfabService.annotations[this.selectedAnnotation][selectedLanguage].description);
		this.annotationHeading$.next(selectedSketchfabService.annotations[this.selectedAnnotation][selectedLanguage].heading);
		this.annotationBlockIsVisible = annotationBlockIsVisible ? false : true;
		this.infoBlockIsVisible = false;
	}

	public showInfoBlock(infoBlockIsVisible: boolean, selectedSketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english') {
		this.helpInfoHeading$.next(selectedSketchfabService.helpInfo[selectedLanguage].heading);
		this.helpInfoText$.next(selectedSketchfabService.helpInfo[selectedLanguage].description);
		this.infoBlockIsVisible = infoBlockIsVisible ? false : true;
		this.annotationBlockIsVisible = false;
	}

	public toggleLanguage(boxContent: InfoBoxContent, selectedLanguage: 'swedish' | 'english') {
		this.annotationDescription$.next(boxContent.description);
		this.annotationHeading$.next(boxContent.heading);

		this.helpInfoText$.next(boxContent.description);
		this.helpInfoHeading$.next(boxContent.heading);

		this.selectedLanguage$.next(selectedLanguage);
	}

	public previousAnnotation$(sketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english'): Observable<boolean> {
		if (this.selectedAnnotation > 0) {
			this.selectedAnnotation--;
		} else {
			this.selectedAnnotation = sketchfabService.annotations.length - 1;
		}

		//If the model is in spinning mode when user opens the annotation box
		sketchfabService.spinning = false;
		this.showClickableLayer$.next(false);

		this.annotationDescription$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].description);
		this.annotationHeading$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].heading);

		return sketchfabService.changeAnnotation(
			sketchfabService.annotations[this.selectedAnnotation].cameraPosition,
			sketchfabService.annotations[this.selectedAnnotation].cameraTarget,
			sketchfabService.animationTime,
			sketchfabService.api,
		).pipe(
			takeUntil(this.untilDestroyed$),
			takeUntil(sketchfabService.changingAnnotation$),
			tap(() => {
				//sketchfabService.cameraIsMoving = false;
			}),
		);
	}

	public nextAnnotation$(sketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english'): Observable<boolean> {

		if (this.selectedAnnotation < sketchfabService.annotations.length - 1) {
			this.selectedAnnotation++;
		} else {
			this.selectedAnnotation = 0;
		}

		//If the model is in spinning mode when user opens the annotation box
		sketchfabService.spinning = false;
		this.showClickableLayer$.next(false);

		this.annotationDescription$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].description);
		this.annotationHeading$.next(sketchfabService.annotations[this.selectedAnnotation][selectedLanguage].heading);

		return sketchfabService.changeAnnotation(
			sketchfabService.annotations[this.selectedAnnotation].cameraPosition,
			sketchfabService.annotations[this.selectedAnnotation].cameraTarget,
			sketchfabService.animationTime,
			sketchfabService.api,
		).pipe(
			takeUntil(this.untilDestroyed$),
			takeUntil(sketchfabService.changingAnnotation$),
			tap(() => {
				//sketchfabService.cameraIsMoving = false;
			}),
		);
	}

	public resetModel$(api: any, lightStates: Array<number[]> | null, sketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english'): Observable<string> {
		sketchfabService.spinning = false;
		if (!lightStates) {
			return of('debug');
		}
		this.selectedAnnotation = 0;

		// reset light positions
		if (lightStates.length) {
			sketchfabService.setLights(api, lightStates);
		}
		this.annotationDescription$.next(sketchfabService.annotations[0][selectedLanguage].description);
		this.annotationHeading$.next(sketchfabService.annotations[0][selectedLanguage].heading);

		return sketchfabService.setInitCameraPos(0, sketchfabService.annotations[0].cameraPosition, sketchfabService.annotations[0].cameraTarget, sketchfabService.api, sketchfabService.resetModelTime).pipe(
			takeUntil(this.untilDestroyed$),
			delay(sketchfabService.resetModelTime * 1000),
			map(() => {
				// Delete this when it is updated in api.addEventListener('camerastop') ??
				sketchfabService.cameraIsMoving = false;
				this.startSpinningInterval$.next(true);
				return 'debug';
			}),
		);
	}

	public stopSpinning(sketchfabService: SketchfabService) {
		sketchfabService.spinning = false;
		this.showClickableLayer$.next(false);
	}
}
