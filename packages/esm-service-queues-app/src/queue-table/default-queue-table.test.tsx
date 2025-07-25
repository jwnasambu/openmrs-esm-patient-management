import { getDefaultsFromConfigSchema, useConfig, useSession } from '@openmrs/esm-framework';
import { screen } from '@testing-library/react';
import {
  mockLocationSurgery,
  mockLocationTriage,
  mockQueueEntries,
  mockQueueRooms,
  mockServices,
  mockSession,
} from '__mocks__';
import React from 'react';
import { renderWithSwr } from 'tools';
import { useQueueRooms } from '../admin/add-provider-queue-room-modal/add-provider-queue-room.resource';
import { type ConfigObject, configSchema } from '../config-schema';
import { useQueueLocations } from '../create-queue-entry/hooks/useQueueLocations';
import { useQueueEntries } from '../hooks/useQueueEntries';
import DefaultQueueTable from '../queue-table/default-queue-table.component';

const mockUseConfig = jest.mocked(useConfig<ConfigObject>);
const mockUseQueueEntries = jest.mocked(useQueueEntries);
const mockQueueLocations = jest.mocked(useQueueLocations);
const mockUseQueueRooms = jest.mocked(useQueueRooms);
const mockUseSession = jest.mocked(useSession);

jest.mock('../hooks/useQueues', () => {
  return {
    useQueues: jest.fn().mockReturnValue({ queues: mockServices }),
  };
});

jest.mock('../create-queue-entry/hooks/useQueueLocations', () => ({
  ...jest.requireActual('../create-queue-entry/hooks/useQueueLocations'),
  useQueueLocations: jest.fn(),
}));

jest.mock('../admin/add-provider-queue-room-modal/add-provider-queue-room.resource', () => ({
  ...jest.requireActual('../admin/add-provider-queue-room-modal/add-provider-queue-room.resource'),
  useQueueRooms: jest.fn(),
}));

jest.mock('../hooks/useQueueEntries', () => ({
  ...jest.requireActual('../hooks/useQueueEntries'),
  useQueueEntries: jest.fn(),
}));

describe('DefaultQueueTable', () => {
  beforeEach(() => {
    mockUseConfig.mockReturnValue({
      ...getDefaultsFromConfigSchema(configSchema),
      customPatientChartUrl: 'someUrl',
      visitQueueNumberAttributeUuid: 'c61ce16f-272a-41e7-9924-4c555d0932c5',
    });
    mockUseSession.mockReturnValue(mockSession.data);
  });

  it('renders an empty state view if data is unavailable', async () => {
    mockQueueLocations.mockReturnValue({ queueLocations: [], isLoading: false, error: null });
    mockUseQueueRooms.mockReturnValue({ rooms: [], isLoading: false, error: undefined });
    mockUseQueueEntries.mockReturnValue({
      queueEntries: [],
      isLoading: false,
      error: undefined,
      totalCount: 0,
      isValidating: false,
      mutate: jest.fn(),
    });

    rendeDefaultQueueTable();

    await screen.findByRole('table');

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(/patients currently in queue/i)).toBeInTheDocument();
    expect(screen.getByText(/no patients to display/i)).toBeInTheDocument();
  });

  it('renders a tabular overview of visit queue entry data when available', async () => {
    mockQueueLocations.mockReturnValue({
      queueLocations: [mockLocationSurgery, mockLocationTriage],
      isLoading: false,
      error: null,
    });
    mockUseQueueRooms.mockReturnValue({ rooms: mockQueueRooms.data.results, isLoading: false, error: undefined });
    mockUseQueueEntries.mockReturnValue({
      queueEntries: mockQueueEntries,
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: jest.fn(),
      totalCount: 2,
    });

    rendeDefaultQueueTable();

    await screen.findByRole('table');

    expect(screen.getByText(/patients currently in queue/i)).toBeInTheDocument();
    expect(screen.queryByText(/no patients to display/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Brian Johnson/i })).toBeInTheDocument();
    const john = screen.getByRole('link', { name: /Alice Johnson/i });
    expect(john).toBeInTheDocument();
    expect(john).toHaveAttribute('href', 'someUrl');

    const expectedColumnHeaders = [
      /name/i,
      /priority/i,
      /coming from/i,
      /status/i,
      /^queue$/i,
      /wait time/i,
      /actions/i,
    ];
    expectedColumnHeaders.forEach((header) => {
      expect(
        screen.getByRole('columnheader', {
          name: header,
        }),
      ).toBeInTheDocument();
    });
  });
});

function rendeDefaultQueueTable() {
  renderWithSwr(<DefaultQueueTable />);
}
