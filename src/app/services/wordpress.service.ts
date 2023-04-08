import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

import { Observable, of, ReplaySubject, shareReplay, switchMap } from 'rxjs';
import { PostMetaFields } from '../models/post-meta-fields';
import { WpModel } from '../models/wp-mode.modell';
import * as testData from '../../assets/testData.json';


@UntilDestroy()
@Injectable()
export class WordpressService {

	public posts$ = new Observable<WpModel[]>;

	public postMetaFields$ = new ReplaySubject<PostMetaFields[]>(1);

	private apiEndpoint = 'http://localhost:8080/wordpress/wp-json/wp/v2/posts?per_page=100';

	private apiEndpointJson = '../../assets/testData.json';

	constructor(
		private http: HttpClient,
	) { }

	public getPostsFromWp(): Observable<WpModel[]> {
		this.posts$ = this.http.get<WpModel[]>(this.apiEndpoint).pipe(
			untilDestroyed(this),
			switchMap(posts => {
				const postMetaFields: PostMetaFields[] = [];

				posts.forEach(post => {
					postMetaFields.push(post.post_meta_fields);
				});

				this.postMetaFields$.next(postMetaFields);
				return of(posts);
			}),
			shareReplay(1),
		);
		return this.posts$;
	}

	public getPostsLocalJsonModule(): Observable<WpModel[]> {
		this.posts$ = of(testData.default.posts);

		return this.posts$;
	}

	public getPostsLocalHttpRequest(): Observable<WpModel[]> {
		this.posts$ = this.http.get<{ posts: WpModel[] }>(this.apiEndpointJson).pipe(
			untilDestroyed(this),
			switchMap((res) => {
				return of(res.posts);
			}),
			shareReplay(1),
		);
		return this.posts$;
	}
}


