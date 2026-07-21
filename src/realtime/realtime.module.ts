import {
  Global,
  Module,
} from '@nestjs/common';

import {
  SessionRealtimeService,
} from './session-realtime.service';

@Global()
@Module({
  providers: [
    SessionRealtimeService,
  ],

  exports: [
    SessionRealtimeService,
  ],
})
export class RealtimeModule {}