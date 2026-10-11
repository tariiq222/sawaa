import { Alert } from 'react-native';
import { queryClient } from '../query-client';

jest.mock('@/i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }));

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

function axiosError(response?: { status: number; data?: unknown }) {
  return Object.assign(new Error('Request failed with status code 500'), { isAxiosError: true, response });
}

async function failQuery(error: unknown) {
  await queryClient.fetchQuery({ queryKey: ['failing', Math.random()], queryFn: () => Promise.reject(error), retry: false }).catch(() => {});
}

async function failMutation(error: unknown) {
  await queryClient.getMutationCache().build(queryClient, { mutationFn: () => Promise.reject(error) }).execute(undefined).catch(() => {});
}

beforeEach(() => alertSpy.mockClear());
afterAll(() => queryClient.clear());

it('never shows the server message for a failed load', async () => {
  await failQuery(axiosError({ status: 500, data: { message: 'Internal server error' } }));
  expect(alertSpy).toHaveBeenCalledWith('common.error', 'common.errorDescription');
});

it('shows the offline copy when no response arrived', async () => {
  await failQuery(Object.assign(new Error('Network Error'), { isAxiosError: true }));
  expect(alertSpy).toHaveBeenCalledWith('common.offlineTitle', 'common.offlineDescription');
});

it('uses translated request copy for a failed mutation without its own handler', async () => {
  await failMutation(axiosError({ status: 400, data: { message: ['phone must be valid'] } }));
  expect(alertSpy).toHaveBeenCalledWith('common.error', 'common.requestFailed');
});

it('stays silent for auth failures', async () => {
  await failQuery(axiosError({ status: 401 }));
  expect(alertSpy).not.toHaveBeenCalled();
});

it('stays silent for requests cancelled after a session change', async () => {
  await failQuery(Object.assign(new Error('Session changed'), { isAxiosError: true, code: 'ERR_CANCELED' }));
  expect(alertSpy).not.toHaveBeenCalled();
});
