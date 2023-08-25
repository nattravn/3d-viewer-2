import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, QueryList, ViewChildren } from '@angular/core';

import { UntilDestroy } from '@ngneat/until-destroy';
import {
	BehaviorSubject,
	combineLatest,
	delay,
	filter,
	finalize,
	interval,
	map,
	Observable,
	of,
	ReplaySubject,
	Subject,
	switchMap,
	take,
	takeUntil,
	tap,
} from 'rxjs';

import { Annotation } from '@app/models/annotation.model';
import { SketchFabModelData } from '@app/models/sketchfab-model-data';
import { WpPostModel } from '@app/models/wp-post.model';
import { InfoBox } from '@app/models/info-box-content.model';
import { LanguageEnum } from '@enum/language.enum';

import { SketchfabService } from '../services/sketchfab.service';
import { WordpressService } from '../services/wordpress.service';

export type Language = LanguageEnum.english | LanguageEnum.swedish;
@UntilDestroy()
@Component({
	selector: 'app-viewer',
	templateUrl: './viewer.component.html',
	styleUrls: ['./viewer.component.scss'],
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ViewerComponent implements OnInit, OnDestroy {
	/** Get handle on cmp tags in the template */
	// eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
	@ViewChildren('viewerRef') viewerRef: QueryList<ElementRef>;

	public annotationDescription$ = new ReplaySubject<string>(1);

	public annotationHeading$ = new ReplaySubject<string>(1);

	public helpInfoHeading$ = new ReplaySubject<string>(1);

	public helpInfoText$ = new ReplaySubject<string>(1);

	public showClickableLayer$ = new ReplaySubject<boolean>(1);

	public selectedLanguage$ = new BehaviorSubject<Language>(LanguageEnum.english);

	public viewersReady$: BehaviorSubject<string> = new BehaviorSubject<string>('Loading iframes');

	public allLoaded$ = new Subject<boolean>();

	// Replay subject instead??
	public infoBlockIsVisible = false;

	public annotationBlockIsVisible = false;

	public selectedAnnotation = 0;

	public sketchfabServices$: Observable<SketchfabService[]>;

	private startSpinningInterval$ = new BehaviorSubject<boolean>(true);

	private readonly INTERVAL_STEP = 5;

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

				return combineLatest(sketchfabServices$);
			}),
			switchMap((resolvedSketchfabServices) => {
				const apireadyArray$: Array<Observable<boolean>> = [];

				resolvedSketchfabServices.forEach((sketchfabService) => {
					apireadyArray$.push(sketchfabService.apiready$);
				});
				return combineLatest(apireadyArray$).pipe(
					filter((apireadyArray) => (apireadyArray.every((elem) => elem) ? true : false)),
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
					filter((texture) => texture),
					switchMap(() => {
						// TODO other solution than next outside service
						this.sketchfabService.selectedSketchfabService$.next(viewers[0]);

						viewers.forEach((viewer: any, i: number) => {
							viewer.api.addEventListener('viewerready', () => {
								// viewer.api.start();
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
				console.log('all done');
			}),
		);

		// Do the spinning
		interval(1000)
			.pipe(
				takeUntil(this.untilDestroyed$),
				switchMap(() => this.startSpinningInterval$),
				filter((startSpinningInterval) => startSpinningInterval),
				switchMap(() => this.sketchfabService.selectedSketchfabService$),
				switchMap((selectedSketchfabService) => {
					if (
						!selectedSketchfabService.cameraIsMoving &&
						selectedSketchfabService.timer % this.INTERVAL_STEP === 0 &&
						selectedSketchfabService.timer > this.INTERVAL_STEP
					) {
						// FIXME selectedSketchfabService.lightStates is only loaded after some seconds
						selectedSketchfabService.setLights(selectedSketchfabService.api, selectedSketchfabService.lightStates);
						this.startSpinningInterval$.next(false);
						this.infoBlockIsVisible = false;
						this.annotationBlockIsVisible = false;
						this.selectedAnnotation = 0;

						return selectedSketchfabService
							.setInitCameraPos(
								0,
								selectedSketchfabService.annotations[0].cameraPosition,
								selectedSketchfabService.annotations[0].cameraTarget,
								selectedSketchfabService.api,
								selectedSketchfabService.resetModelTime,
							)
							.pipe(
								delay(selectedSketchfabService.resetModelTime * 1000 + 1000),
								map(() => {
									// Camera can be in moving mode here if user have clicked on next annotation. The spinning should be ignored then
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
			)
			.subscribe();
	}

	ngOnDestroy() {
		this.startSpinningInterval$.next(false);
		this.startSpinningInterval$.complete();

		this.untilDestroyed$.next(true);
		this.untilDestroyed$.complete();
	}

	public stopSpinning(sketchfabService: SketchfabService) {
		sketchfabService.spinning = false;
		this.showClickableLayer$.next(false);
	}

	private initWPpostData(post: WpPostModel, index: number): SketchfabService {
		const annotations = new Array<Annotation>();

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

		const sketchfabServices = new SketchfabService(sketchFabModelData);

		if (iframe) {
			sketchfabServices.init(iframe, post.post_meta_fields.model_id, 0);
		} else {
			console.error('iframe element is: ', iframe);
		}

		return sketchfabServices;
	}
}
