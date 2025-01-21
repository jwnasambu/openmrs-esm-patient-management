import React from 'react';
import { type Patient, type PatientIdentifier, PatientBannerPatientIdentifiers } from '@openmrs/esm-framework';
import { useElementConfig } from '../../ward-view/ward-view.resource';
import styles from './ward-patient-identifier.scss';

export interface WardPatientIdentifierProps {
  patient: Patient;
  id?: string;
}

const WardPatientIdentifier: React.FC<WardPatientIdentifierProps> = ({ id, patient }) => {
  const config = useElementConfig('patientIdentifier', id);

  const fhirIdentifiers: fhir.Identifier[] = patient.identifiers.map((identifier: PatientIdentifier) => ({
    value: identifier.identifier,
    type: {
      text: identifier.identifierType.name,
      coding: [
        {
          code: identifier.identifierType.uuid,
        },
      ],
    },
  }));

  return (
    <div className={styles.wardPatientIdentifierWrapper}>
      <PatientBannerPatientIdentifiers
        identifiers={fhirIdentifiers}
        showIdentifierLabel={config?.showIdentifierLabel}
      />
    </div>
  );
};

export default WardPatientIdentifier;
