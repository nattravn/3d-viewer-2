import { ChangeDetectionStrategy,  Component, ElementRef, OnInit, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { WordpressService } from '../services/wordpress.service';
import { SketchfabService } from '../services/sketchfab.service';
import { BehaviorSubject, combineLatest, delay, filter, finalize, interval, map, Observable, of, ReplaySubject, Subject, switchMap, take, takeUntil } from 'rxjs';
import { WpPostModel } from '../models/wp-post.model';
import { InfoBox } from '../models/info-box-content.model';
import { Annotation } from '../models/annotation.model';



@Component({
	selector: 'app-viewer',
	templateUrl: './viewer.component.html',
	styleUrls: ['./viewer.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerComponent implements OnInit {

	@ViewChild('postContainer') postContainer: ElementRef;

	@ViewChild('iframeContainer') iframeContainerRef: ElementRef;

	/** Get handle on cmp tags in the template */
	@ViewChildren('viewerRef') viewerRef:QueryList<ElementRef>;

	public readonly baseUrl = 'http://localhost:8080/wordpress/';

	public annotationDescription$ = new ReplaySubject<string>(1);

	public annotationTitle$ = new ReplaySubject<string>(1);

	public helpInfoHeading$ = new ReplaySubject<string>(1);

	public helpInfoText$ = new ReplaySubject<string>(1);

	public selectedLanguage$ = new BehaviorSubject<'swedish' | 'english'>('english');

	public viewersReady$: BehaviorSubject<string> = new BehaviorSubject<string>('Loading iframes');

	public allLoaded$ = new Subject<boolean>();

	// Replay subject instead??
	public infoBlockIsVisible = false;

	public annotationBlockIsVisible = false;

	public selectedAnnotation = 0;

	public sketchfabServices$: Array<Observable<SketchfabService>> = [];

	public selectedSketchfabService$ = new ReplaySubject<SketchfabService>(1);

	private destroy$ = new Subject<void>();

	constructor(
		public wordpressService: WordpressService,
		public sketchfabService: SketchfabService,
	) {}

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
					selectedSketchfabService.setInitCameraPos(0, selectedSketchfabService.annotations[0].cameraPosition, selectedSketchfabService.annotations[0].cameraTarget, selectedSketchfabService.api, selectedSketchfabService.resetModelTime, (err: boolean) => {
						console.log("error: ", err);
						if (!err) {
							console.log("start rotating");
							selectedSketchfabService.updateRotation(0, selectedSketchfabService.rootMatrixNodeId, selectedSketchfabService.api);
						}
					});
				} else {
					// Do nothing
				}
				selectedSketchfabService.timer++;
				return selectedSketchfabService.timer;
			}),
		).subscribe();
	}

	ngOnDestroy() {
		this.destroy$.next();
   		this.destroy$.complete();
	}

	private initWPpostData(post: WpPostModel, index: number, sketchfabServices: SketchfabService[]): SketchfabService {
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
		const annotationBounds = {
			animationTime: post.post_meta_fields.animation_time,
			resetModelTime: post.post_meta_fields.reset_model_time,
			spinVelocity: post.post_meta_fields.spin_velocity,
			orbitPanFactor: post.post_meta_fields.orbit_pan_factor,
			orbitRotationFactor: post.post_meta_fields.orbit_rotation_factor,
			orbitZoomFactor: post.post_meta_fields.orbit_zoom_factor,
			logCamera: post.post_meta_fields.log_camera,
			rot_axis: post.post_meta_fields.rot_axis,
			annotations: annotations,
			helpInfo: helpInfo,
			modelIndex: index,
		};

		sketchfabServices.push(new SketchfabService());

		//const iframe = document.getElementById(`api-frame-${post.id}`);
		const iframe = this.viewerRef.get(index)?.nativeElement;

		if (iframe) {
			const client = sketchfabServices[index].init(iframe, post.post_meta_fields.model_id, annotationBounds, 0);
		}

		return sketchfabServices[index];
	}

	public selectModel(sketchfabServicePrev: SketchfabService, sketchfabServiceNext: SketchfabService, selectedLanguage: 'swedish' | 'english') {
		if (sketchfabServiceNext.modelIndex != null) {
			this.viewerRef.get(sketchfabServiceNext.modelIndex)?.nativeElement.scrollIntoView();
		}

		sketchfabServicePrev.setLDtexture((readyTexture: any) => {
			// remove loading bar and loadTextureLayer
			if (readyTexture) {
				sketchfabServicePrev.setInitCameraPos(0, sketchfabServicePrev.annotations[0].cameraPosition, sketchfabServicePrev.annotations[0].cameraTarget, sketchfabServicePrev.api, 0.01, () => { });
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

	public resetModel(modelChanged: boolean, lightStates: Array<number[]> | null, sketchfabService: SketchfabService, selectedLanguage: 'swedish' | 'english') {

		if (!lightStates) {
			return;
		}
		this.selectedAnnotation = 0;

		// reset light positions
		sketchfabService.setLights(lightStates);

		// if modelChanged is true use animation time
		sketchfabService.setInitCameraPos(0, sketchfabService.annotations[0].cameraPosition, sketchfabService.annotations[0].cameraTarget, sketchfabService.api, sketchfabService.resetModelTime, () => { });

		this.annotationDescription$.next(sketchfabService.annotations[0][selectedLanguage].description);
		this.annotationTitle$.next(sketchfabService.annotations[0][selectedLanguage].heading);
	}

	public toggleLanguage(annotations: any, selectedLanguage: 'swedish' | 'english', selectedAnnotation: number) {
		this.annotationDescription$.next(annotations.descriptions[selectedAnnotation]);
		this.annotationTitle$.next(annotations.titles[selectedAnnotation]);

		this.selectedLanguage$.next(selectedLanguage);
	}
}
