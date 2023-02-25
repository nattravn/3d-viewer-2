import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';

import { Observable, of, ReplaySubject, shareReplay, switchMap, tap } from 'rxjs';
import { WpModel } from '../models/wp-model';


@UntilDestroy()
@Injectable()
export class WordpressService {

	public posts$ = new Observable<WpModel[]>;

	constructor(
		private http: HttpClient,
	) { }

	public getPosts(): Observable<WpModel[]> {
		this.posts$ = this.http.get<WpModel[]>('http://localhost:8080/wordpress/wp-json/wp/v2/posts?per_page=100').pipe(
			untilDestroyed(this),
			switchMap(posts => {
				console.log('posts ', posts);
				return of(posts);
			}),
			shareReplay(1),
		);
		return this.posts$;
	}

	public getPostsLocal(): Observable<WpModel[]> {
		this.posts$ = this.http.get<WpModel[]>('./testData.json').pipe(
			untilDestroyed(this),
			switchMap(posts => {
				console.log('posts ', posts);
				return of(posts);
			}),
			shareReplay(1),
		);
		return this.posts$;
	}
}


