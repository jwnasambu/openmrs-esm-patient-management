import {
  formatDate,
  openmrsFetch,
  parseDate,
  restBaseUrl,
  type Visit,
  type Encounter as CoreEncounter,
  type Obs,
} from '@openmrs/esm-framework';
import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isEmpty from 'lodash-es/isEmpty';
import useSWR from 'swr';
import { type Concept, type Identifer, type MappedServiceQueueEntry, type Queue, type QueueEntry } from './types';

dayjs.extend(isToday);

export interface VisitQueueEntry {
  queueEntry: QueueEntry;
  uuid: string;
  visit: Visit;
}

export interface MappedVisitQueueEntry {
  id: string;
  encounters: Array<MappedEncounter>;
  name: string;
  patientAge: string;
  patientDob: string;
  patientGender: string;
  patientUuid: string;
  queue: Queue;
  priority: Concept;
  priorityComment: string;
  status: Concept;
  startedAt: Date;
  endedAt: Date;
  visitType: string;
  visitUuid: string;
  visitTypeUuid: string;
  queueUuid: string;
  queueEntryUuid: string;
  queueLocation: string;
  sortWeight: number;
  visitQueueNumber: string;
  identifiers: Array<Identifer>;
  queueComingFrom: string;
}

interface Encounter {
  diagnoses?: Array<any>;
  encounterDatetime?: string;
  encounterProviders?: Array<{ provider?: { person?: { display?: string } } }>;
  encounterType?: { display: string; uuid: string };
  obs?: Array<Obs>;
  uuid: string;
  voided?: boolean;
}

interface MappedEncounter extends Omit<Encounter, 'encounterType' | 'provider'> {
  encounterType: string;
  provider: string;
}

const mapEncounterProperties = (encounter: CoreEncounter): MappedEncounter => ({
  diagnoses: encounter.diagnoses,
  encounterDatetime: encounter.encounterDatetime,
  encounterType: encounter.encounterType.display,
  obs: encounter.obs,
  provider: encounter.encounterProviders[0]?.provider?.person?.display,
  uuid: encounter.uuid,
  voided: encounter.voided,
});

export const mapVisitQueueEntryProperties = (
  queueEntry: QueueEntry,
  visitQueueNumberAttributeUuid: string,
): MappedVisitQueueEntry => ({
  id: queueEntry.uuid,
  encounters: queueEntry.visit?.encounters?.map(mapEncounterProperties),
  name: queueEntry.display,
  patientUuid: queueEntry.patient.uuid,
  patientAge: queueEntry.patient.person?.age + '',
  patientDob: queueEntry?.patient?.person?.birthdate
    ? formatDate(parseDate(queueEntry.patient.person.birthdate), { time: false })
    : '--',
  patientGender: queueEntry.patient.person.gender,
  queue: queueEntry.queue,
  priority: queueEntry.priority,
  priorityComment: queueEntry.priorityComment,
  status: queueEntry.status,
  startedAt: dayjs(queueEntry.startedAt).toDate(),
  endedAt: queueEntry.endedAt ? dayjs(queueEntry.endedAt).toDate() : null,
  visitType: queueEntry.visit?.visitType?.display,
  queueLocation: (queueEntry?.queue as any)?.location?.uuid,
  visitTypeUuid: queueEntry.visit?.visitType?.uuid,
  visitUuid: queueEntry.visit?.uuid,
  queueUuid: queueEntry.queue.uuid,
  queueEntryUuid: queueEntry.uuid,
  sortWeight: queueEntry.sortWeight,
  visitQueueNumber: queueEntry.visit?.attributes?.find((e) => e?.attributeType?.uuid === visitQueueNumberAttributeUuid)
    ?.value,
  identifiers: queueEntry.patient?.identifiers as Identifer[],
  queueComingFrom: queueEntry?.queueComingFrom?.name,
});

export async function updateQueueEntry(
  visitUuid: string,
  previousQueueUuid: string,
  newQueueUuid: string,
  queueEntryUuid: string,
  patientUuid: string,
  priority: string,
  status: string,
  endedAt: Date,
  sortWeight: number,
) {
  const abortController = new AbortController();
  const queueServiceUuid = isEmpty(newQueueUuid) ? previousQueueUuid : newQueueUuid;

  await Promise.all([endPatientStatus(previousQueueUuid, queueEntryUuid, endedAt)]);

  return openmrsFetch(`${restBaseUrl}/visit-queue-entry`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      visit: { uuid: visitUuid },
      queueEntry: {
        status: {
          uuid: status,
        },
        priority: {
          uuid: priority,
        },
        queue: {
          uuid: queueServiceUuid,
        },
        patient: {
          uuid: patientUuid,
        },
        startedAt: new Date(),
        sortWeight: sortWeight,
        queueComingFrom: previousQueueUuid,
      },
    },
  });
}

export async function endPatientStatus(previousQueueUuid: string, queueEntryUuid: string, endedAt: Date) {
  const abortController = new AbortController();
  await openmrsFetch(`${restBaseUrl}/queue/${previousQueueUuid}/entry/${queueEntryUuid}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      endedAt: endedAt,
    },
  });
}

export function useServiceQueueEntries(service: string, locationUuid: string) {
  const apiUrl = `${restBaseUrl}/visit-queue-entry?status=waiting&service=${service}&location=${locationUuid}&v=full`;
  const { data, error, isLoading, isValidating } = useSWR<{ data: { results: Array<VisitQueueEntry> } }, Error>(
    service && locationUuid ? apiUrl : null,
    openmrsFetch,
  );

  const mapServiceQueueEntryProperties = (visitQueueEntry: VisitQueueEntry): MappedServiceQueueEntry => ({
    id: visitQueueEntry.queueEntry.uuid,
    name: visitQueueEntry.queueEntry.display,
    age: visitQueueEntry.queueEntry.patient ? visitQueueEntry?.queueEntry?.patient?.person?.age + '' : '--',
    returnDate: visitQueueEntry.queueEntry.startedAt,
    visitType: visitQueueEntry.visit?.visitType?.display,
    gender: visitQueueEntry.queueEntry.patient ? visitQueueEntry?.queueEntry?.patient?.person?.gender : '--',
    patientUuid: visitQueueEntry.queueEntry ? visitQueueEntry?.queueEntry.uuid : '--',
  });

  const mappedServiceQueueEntries = data?.data?.results?.map(mapServiceQueueEntryProperties);

  return {
    serviceQueueEntries: mappedServiceQueueEntries ? mappedServiceQueueEntries : [],
    isLoading,
    error,
    isValidating,
  };
}

export function serveQueueEntry(servicePointName: string, ticketNumber: string, status: string) {
  const abortController = new AbortController();

  return openmrsFetch(`${restBaseUrl}/queueutil/assignticket`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    signal: abortController.signal,
    body: {
      servicePointName,
      ticketNumber,
      status,
    },
  });
}
