import { ConfigModule } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule (Test)', () => {
    let moduleRef: TestingModule;

    beforeAll(async () => {
        moduleRef = await Test.createTestingModule({
            imports: [
                ConfigModule.forRoot({
                    isGlobal: true,
                    ignoreEnvFile: true,
                    load: [() => ({ DATABASE_CONNECTION_STRING: 'mongodb://localhost/fake' })],
                }),
                AppModule,
            ],
        })
            .overrideProvider(getConnectionToken('default'))
            .useValue({})
            .compile();
    }, 5000);

    it('should compile the app module without connecting to a real DB', () => {
        expect(moduleRef).toBeDefined();
    });
    afterAll(async () => {
        await moduleRef.close();
    });
});
