export class PostMetaFields {
	public model_id: string;

	public image_url: string;

	public image_id: number;

	public image_filename: string;

	public _edit_last: number;

	public swe_description: string[];

	public eng_description: string[];

	public swe_title: string[];

	public eng_title: string[];

	public camera_position: Array<number[]>;

	public camera_target: Array<number[]>;

	public animation_time: number;

	public reset_time: number;

	public spin_velocity: number;

	public swe_help_text: string;

	public eng_help_text: string;

	public swe_help_heading: string;

	public eng_help_heading: string;

	public eng_model_title: string;

	public reset_model_time: number;

	public menu_scale: number;

	public textbox_scale: number;

	public orbit_pan_factor: number;

	public orbit_rotation_factor: number;

	public orbit_zoom_factor: number;

	public log_camera: boolean;

	public edit_lock: string;

	public rot_axis: { x:number, y:number, z:number };
}

