import { Links } from './links';
import { PostMetaFields } from './post-meta-fields';

export class WpPostModel {
	public author: number;

	public categories: number[];

	public comment_status: string;

	public content: {
		protected: boolean;
		rendered: string;
	};

	public date: string;

	public date_gmt: string;

	public excerpt: {
		rendered: string;
		protected: boolean;
	};

	public featured_media: number;

	public format: string;

	public guid:{ rendered: string };

	public id: number;

	public link: string;

	public meta: [];

	public modified: string;

	public modified_gmt: string;

	public ping_status: string;

	public post_meta_fields: PostMetaFields;

	public slug: string;

	public status: string;

	public sticky: boolean;

	public tags:[];

	public template: string;

	public title:{ rendered: string };

	public type: string;

	public _links: Links;
}
