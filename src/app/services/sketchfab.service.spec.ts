/* tslint:disable:no-unused-variable */

import { TestBed, async, inject } from '@angular/core/testing';
import { SketchfabService } from './sketchfab.service';

describe('Service: Sketchfab', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SketchfabService]
    });
  });

  it('should ...', inject([SketchfabService], (service: SketchfabService) => {
    expect(service).toBeTruthy();
  }));
});
