import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

import { Observable, of, ReplaySubject, shareReplay, switchMap } from 'rxjs';
import { PostMetaFields } from '../models/post-meta-fields';
import { WpPostModel } from '../models/wp-post.model';
import * as testData from '../../assets/testData.json';

@UntilDestroy()
@Injectable()
export class WordpressService {
	public posts$ = new Observable<WpPostModel[]>();

	public postMetaFields$ = new ReplaySubject<PostMetaFields[]>(1);

	private apiEndpoint = 'http://localhost:8080/wordpress/wp-json/wp/v2/posts?per_page=100';

	private apiEndpointJson = '../../assets/testData.json';

	constructor(private http: HttpClient) {}

	public getPostsFromWp(): Observable<WpPostModel[]> {
		this.posts$ = this.http.get<WpPostModel[]>(this.apiEndpoint).pipe(
			untilDestroyed(this),
			switchMap((posts) => {
				const postMetaFields: PostMetaFields[] = [];
				console.log('posts: ', posts);
				posts.forEach((post) => {
					postMetaFields.push(post.post_meta_fields);
				});

				this.postMetaFields$.next(postMetaFields);
				return of(posts);
			}),
			shareReplay(1),
		);
		return this.posts$;
	}

	public getPostsLocalJsonModule(): Observable<WpPostModel[]> {
		this.posts$ = of(testData.default.posts);

		return this.posts$;
	}

	public getPostsLocalHttpRequest(): Observable<WpPostModel[]> {
		this.posts$ = this.http.get<{ posts: WpPostModel[] }>(this.apiEndpointJson).pipe(
			untilDestroyed(this),
			switchMap((res) => of(res.posts)),
			shareReplay(1),
		);
		return this.posts$;
	}
}
