export interface GlobalProcessConfig {
    // Node related
    eventNodeLabel: string;
    entityNodeLabel: string;
    activityProperty: string;
    entityFilterProperty: string;
    timestampProperty: string;

    // Relationship related
    dfBaseRelName: string;
    corrRelName: string;
    dfEntityRelName: string;

    // How is the DF type distinguished?
    dfTypeDistinction: 'label' | 'property';

    // Property on DF relationship indicating type (optional, only if dfTypeDistinction === 'property')
    dfTypePropertyName?: string;
}

export const initialGlobalProcessConfig: GlobalProcessConfig = {
    eventNodeLabel: 'Event',
    entityNodeLabel: 'Entity',
    activityProperty: 'type',
    entityFilterProperty: 'type',
    timestampProperty: 'time',
    dfBaseRelName: 'DF',
    corrRelName: 'CORR',
    dfEntityRelName: 'DF_ENTITY',
    dfTypeDistinction: 'label',
    dfTypePropertyName: undefined,
};


// Example of a more specific config for a known dataset
export const bpic2017Config: GlobalProcessConfig = {
    eventNodeLabel: 'Event',
    entityNodeLabel: 'Application',
    activityProperty: 'concept:name',
    entityFilterProperty: 'type', // Assuming 'Application' nodes have a 'type' property if needed
    timestampProperty: 'time:timestamp',
    dfBaseRelName: 'DF_APPLICATION',
    corrRelName: 'CORR',
    dfEntityRelName: 'DF_ENTITY', // This might not be applicable or needs to be defined
    dfTypeDistinction: 'label',
};