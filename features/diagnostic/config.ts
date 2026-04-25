import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import type {
  AirflowStrengthAnswer,
  BreakerDisconnectStatusAnswer,
  BlowerDiagKey,
  BlowerTypeAnswer,
  CompressorDiagKey,
  CondenserFanDiagKey,
  DiagnosticRouteId,
  FilterConditionAnswer,
  IceLocationAnswer,
  IndoorPlatformId,
  IndoorUnitDiagKey,
  IcingGateKey,
  IssueId,
  NoCoolingGateKey,
  NoAirflowGateKey,
  OutdoorUnitDiagKey,
  OutdoorUnitNotRunningGateKey,
  OutdoorUnitNoiseAnswer,
  LowVoltageDiagKey,
  LineVoltageDiagKey,
  SystemIdleGateKey,
  SystemTypeId,
  TriStateAnswer,
  WeakCoolingGateKey,
} from '@/types/diagnostic';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface SystemTypeOption {
  id: SystemTypeId;
  title: string;
  description: string;
  icon: IconName;
  accentColor?: string;
  requiresSplitFollowUp?: boolean;
}

export interface SplitSystemOption {
  id: IndoorPlatformId;
  title: string;
  description: string;
  icon: IconName;
}

export interface IntakeMethodOption {
  id: 'scan' | 'manual_model' | 'manual_selection';
  title: string;
  description: string;
  icon: IconName;
  accentColor?: string;
}

export interface IssueOption {
  id: IssueId;
  title: string;
  subtitle: string;
  icon: IconName;
}

export interface ChoiceOption<T extends string> {
  label: string;
  value: T;
}

export interface GateQuestionConfig<T extends string> {
  key:
    | NoAirflowGateKey
    | NoCoolingGateKey
    | WeakCoolingGateKey
    | SystemIdleGateKey
    | IcingGateKey
    | OutdoorUnitNotRunningGateKey
    | IndoorUnitDiagKey
    | OutdoorUnitDiagKey
    | LowVoltageDiagKey
    | LineVoltageDiagKey
    | BlowerDiagKey
    | CompressorDiagKey
    | CondenserFanDiagKey;
  title: string;
  helper: string;
  options: ChoiceOption<T>[];
}

export const triStateOptions: ChoiceOption<TriStateAnswer>[] = [
  { label: 'Yes', value: 'yes' },
  { label: 'No', value: 'no' },
  { label: 'Not sure', value: 'not_sure' },
];

export const airflowStrengthOptions: ChoiceOption<AirflowStrengthAnswer>[] = [
  { label: 'Strong', value: 'strong' },
  { label: 'Weak', value: 'weak' },
  { label: 'None', value: 'none' },
  { label: 'Not sure', value: 'not_sure' },
];

export const filterConditionOptions: ChoiceOption<FilterConditionAnswer>[] = [
  { label: 'Clean', value: 'clean' },
  { label: 'Dirty', value: 'dirty' },
  { label: 'Not sure', value: 'not_sure' },
];

export const iceLocationOptions: ChoiceOption<IceLocationAnswer>[] = [
  { label: 'Indoor coil', value: 'indoor_coil' },
  { label: 'Outdoor unit', value: 'outdoor_unit' },
  { label: 'Lineset', value: 'lineset' },
  { label: 'Not sure', value: 'not_sure' },
];

export const outdoorNoiseOptions: ChoiceOption<OutdoorUnitNoiseAnswer>[] = [
  { label: 'None', value: 'none' },
  { label: 'Humming', value: 'humming' },
  { label: 'Clicking', value: 'clicking' },
  { label: 'Buzzing', value: 'buzzing' },
  { label: 'Not sure', value: 'not_sure' },
];

export const breakerStatusOptions: ChoiceOption<BreakerDisconnectStatusAnswer>[] = [
  { label: 'On', value: 'on' },
  { label: 'Off', value: 'off' },
  { label: 'Tripped', value: 'tripped' },
  { label: 'Not sure', value: 'not_sure' },
];

export const systemTypeOptions: SystemTypeOption[] = [
  {
    id: 'split_system_ac',
    title: 'Split System AC',
    description: 'Air conditioner',
    icon: 'air-conditioner',
    requiresSplitFollowUp: true,
  },
  {
    id: 'heat_pump',
    title: 'Heat Pump',
    description: 'Heating & cooling',
    icon: 'heat-pump',
    accentColor: '#9B77FF',
  },
  {
    id: 'furnace',
    title: 'Furnace',
    description: 'Heating only',
    icon: 'fire',
    accentColor: '#F3A64B',
  },
  {
    id: 'package_unit',
    title: 'Package Unit',
    description: 'All-in-one system',
    icon: 'fan',
    accentColor: '#8F6FFF',
  },
  {
    id: 'mini_split',
    title: 'Mini Split / Ductless',
    description: 'Ductless systems',
    icon: 'air-filter',
  },
  {
    id: 'commercial_rtu',
    title: 'Commercial / RTU',
    description: 'Commercial systems',
    icon: 'office-building',
    accentColor: '#8F6FFF',
  },
  {
    id: 'refrigeration',
    title: 'Refrigeration',
    description: 'Coolers, freezers',
    icon: 'snowflake',
    accentColor: '#4EA2FF',
  },
  {
    id: 'boiler',
    title: 'Boiler',
    description: 'Hot water / steam',
    icon: 'water-boiler',
    accentColor: '#8F6FFF',
  },
  {
    id: 'not_sure',
    title: 'Not Sure',
    description: 'Help me figure it out',
    icon: 'help-circle-outline',
    accentColor: '#8092AE',
  },
];

export const intakeMethodOptions: IntakeMethodOption[] = [
  {
    id: 'scan',
    title: 'Scan Data Tag',
    description: "Scan the unit's data plate to capture model info, specs, and warranty context.",
    icon: 'line-scan',
  },
  {
    id: 'manual_model',
    title: 'Enter Model Manually',
    description: 'Enter brand, model number, and serial details before routing.',
    icon: 'keyboard-outline',
    accentColor: '#8F6FFF',
  },
  {
    id: 'manual_selection',
    title: 'Select System Type',
    description: 'Keep moving with manual equipment selection only.',
    icon: 'view-grid-outline',
    accentColor: '#F3A64B',
  },
];

export const splitSystemOptions: SplitSystemOption[] = [
  {
    id: 'air_handler',
    title: 'Air Handler',
    description: 'Indoor unit with electric heat or straight cooling',
    icon: 'fan',
  },
  {
    id: 'furnace',
    title: 'Furnace',
    description: 'Indoor furnace paired with outdoor equipment',
    icon: 'fire',
  },
  {
    id: 'not_sure',
    title: 'Not Sure',
    description: 'Keep moving and sort it out later',
    icon: 'help-circle-outline',
  },
];

export const issueOptions: IssueOption[] = [
  {
    id: 'no_cooling',
    title: 'No Cooling',
    subtitle: 'System runs, but space is not cooling',
    icon: 'snowflake-off',
  },
  {
    id: 'outdoor_unit_not_running',
    title: 'Outdoor Unit Not Running',
    subtitle: 'Direct entry for condenser or condensing unit faults',
    icon: 'fan-alert',
  },
  {
    id: 'weak_cooling',
    title: 'Weak Cooling',
    subtitle: 'Cooling is present, but not enough',
    icon: 'thermometer-low',
  },
  {
    id: 'no_airflow',
    title: 'No Airflow',
    subtitle: 'Little to no air from supply vents',
    icon: 'fan-off',
  },
  {
    id: 'weak_airflow',
    title: 'Weak Airflow',
    subtitle: 'Air is moving, but volume feels low',
    icon: 'weather-windy',
  },
  {
    id: 'icing_frozen_coil',
    title: 'Icing / Frozen Coil',
    subtitle: 'Ice buildup or signs of freezing',
    icon: 'snowflake-melt',
  },
  {
    id: 'system_not_doing_anything',
    title: 'System Not Doing Anything',
    subtitle: 'No obvious response from equipment',
    icon: 'power-plug-off',
  },
  {
    id: 'short_cycling',
    title: 'Short Cycling',
    subtitle: 'Starts and stops too quickly',
    icon: 'timer-sand',
  },
  {
    id: 'other',
    title: 'Other',
    subtitle: 'Start with a broad issue lane',
    icon: 'dots-horizontal-circle-outline',
  },
];

export const noAirflowGateQuestions: GateQuestionConfig<TriStateAnswer | BlowerTypeAnswer>[] = [
  {
    key: 'thermostatCalling',
    title: 'Is thermostat calling for cooling?',
    helper: 'Use the actual call state, not just the setpoint.',
    options: triStateOptions,
  },
  {
    key: 'indoorFanRunning',
    title: 'Is the indoor fan running?',
    helper: 'Listen for the blower or check for obvious fan movement.',
    options: triStateOptions,
  },
  {
    key: 'indoorUnitPower',
    title: 'Do you have power to the indoor unit?',
    helper: 'Confirm line power before chasing control logic.',
    options: triStateOptions,
  },
  {
    key: 'boardFaultLights',
    title: 'Any board fault lights?',
    helper: 'Check for visible status or fault LEDs.',
    options: triStateOptions,
  },
  {
    key: 'blowerType',
    title: 'What kind of blower is it?',
    helper: 'Choose the best match for the indoor motor.',
    options: [
      { label: 'PSC', value: 'psc' },
      { label: 'ECM', value: 'ecm' },
      { label: 'Not sure', value: 'not_sure' },
    ],
  },
];

export const noCoolingGateQuestions: GateQuestionConfig<TriStateAnswer | AirflowStrengthAnswer>[] = [
  {
    key: 'thermostatCalling',
    title: 'Is thermostat calling for cooling?',
    helper: 'Confirm the actual cooling call at the equipment if possible.',
    options: triStateOptions,
  },
  {
    key: 'indoorFanRunning',
    title: 'Is the indoor fan running?',
    helper: 'This is the quickest separator between indoor and outdoor paths.',
    options: triStateOptions,
  },
  {
    key: 'airflowStrength',
    title: 'Is there airflow?',
    helper: 'Use what you feel at the supply, not just whether the blower is audible.',
    options: airflowStrengthOptions,
  },
  {
    key: 'outdoorUnitRunning',
    title: 'Is the outdoor unit running?',
    helper: 'Listen for the condenser fan or compressor outside.',
    options: triStateOptions,
  },
  {
    key: 'condenserFanRunning',
    title: 'Condenser fan running?',
    helper: 'Separate fan operation from overall outdoor operation if possible.',
    options: triStateOptions,
  },
  {
    key: 'compressorRunning',
    title: 'Compressor running?',
    helper: 'Use actual sound, vibration, or amp draw if you have it.',
    options: triStateOptions,
  },
  {
    key: 'contactorEngaged',
    title: 'Contactor pulled in?',
    helper: 'This helps separate a control issue from a load-side failure.',
    options: triStateOptions,
  },
];

export const weakCoolingGateQuestions: GateQuestionConfig<
  TriStateAnswer | AirflowStrengthAnswer | FilterConditionAnswer
>[] = [
  {
    key: 'airflowStrength',
    title: 'Airflow strong or weak?',
    helper: 'Weak airflow changes the whole branch. Start there.',
    options: airflowStrengthOptions,
  },
  {
    key: 'outdoorUnitRunning',
    title: 'Is the outdoor unit running?',
    helper: 'Confirm whether the condenser is participating at all.',
    options: triStateOptions,
  },
  {
    key: 'indoorFanRunning',
    title: 'Is the indoor fan running?',
    helper: 'Weak cooling can still hide an indoor airflow or blower problem.',
    options: triStateOptions,
  },
  {
    key: 'icingPresent',
    title: 'Any icing present?',
    helper: 'Visible ice changes the likely lane quickly.',
    options: triStateOptions,
  },
  {
    key: 'filterCondition',
    title: 'Filter condition?',
    helper: 'Use the quickest field read: clean, dirty, or not sure.',
    options: filterConditionOptions,
  },
];

export const systemIdleGateQuestions: GateQuestionConfig<
  TriStateAnswer | BreakerDisconnectStatusAnswer
>[] = [
  {
    key: 'thermostatPowered',
    title: 'Is the thermostat powered?',
    helper: 'No thermostat power is a clean early separator.',
    options: triStateOptions,
  },
  {
    key: 'thermostatCalling',
    title: 'Is thermostat calling?',
    helper: 'If there is no call, stay upstream.',
    options: triStateOptions,
  },
  {
    key: 'indoorUnitPower',
    title: 'Is the indoor unit powered?',
    helper: 'Line power matters before deeper control questions.',
    options: triStateOptions,
  },
  {
    key: 'outdoorUnitPower',
    title: 'Is the outdoor unit powered?',
    helper: 'Use only if known. Do not stall the flow for a hard measurement.',
    options: triStateOptions,
  },
  {
    key: 'breakerDisconnectStatus',
    title: 'Breaker or disconnect status?',
    helper: 'Capture whether the main power state is on, off, tripped, or unknown.',
    options: breakerStatusOptions,
  },
  {
    key: 'lowVoltagePresent',
    title: 'Any low voltage present?',
    helper: 'A missing 24V supply points to a different backbone than a missing call.',
    options: triStateOptions,
  },
];

export const icingGateQuestions: GateQuestionConfig<
  TriStateAnswer | FilterConditionAnswer | IceLocationAnswer
>[] = [
  {
    key: 'iceLocation',
    title: 'Where is the ice?',
    helper: 'Pick the strongest visible freeze-up point.',
    options: iceLocationOptions,
  },
  {
    key: 'restrictionObserved',
    title: 'Is airflow restricted?',
    helper: 'Use obvious restriction clues only.',
    options: triStateOptions,
  },
  {
    key: 'filterCondition',
    title: 'Filter condition?',
    helper: 'Dirty filters are a fast first-pass freeze-up clue.',
    options: filterConditionOptions,
  },
  {
    key: 'indoorFanRunning',
    title: 'Is the blower running?',
    helper: 'A blower issue can create the freeze-up condition by itself.',
    options: triStateOptions,
  },
  {
    key: 'outdoorUnitRunning',
    title: 'Is the outdoor unit running?',
    helper: 'This helps separate refrigeration from pure indoor airflow faults.',
    options: triStateOptions,
  },
];

export const outdoorUnitNotRunningGateQuestions: GateQuestionConfig<
  TriStateAnswer | OutdoorUnitNoiseAnswer | BreakerDisconnectStatusAnswer
>[] = [
  {
    key: 'indoorFanRunning',
    title: 'Is the indoor unit running?',
    helper: 'If the indoor side is responding, the condenser path gets stronger.',
    options: triStateOptions,
  },
  {
    key: 'thermostatCalling',
    title: 'Is thermostat calling?',
    helper: 'No call keeps the first branch upstream of the condenser.',
    options: triStateOptions,
  },
  {
    key: 'contactorEngaged',
    title: 'Is the contactor pulled in?',
    helper: 'This separates control issues from load-side or power issues.',
    options: triStateOptions,
  },
  {
    key: 'outdoorUnitNoise',
    title: 'Any noise from the unit?',
    helper: 'A hum, click, or buzz can point to partial outdoor operation.',
    options: outdoorNoiseOptions,
  },
  {
    key: 'breakerDisconnectStatus',
    title: 'Breaker or disconnect status?',
    helper: 'Capture the obvious outdoor power state if known.',
    options: breakerStatusOptions,
  },
];

export const indoorUnitQuestions: GateQuestionConfig<string>[] = [
  {
    key: 'highVoltagePresent',
    title: 'High voltage present?',
    helper: 'Confirm line voltage is actually reaching the indoor section.',
    options: triStateOptions,
  },
  {
    key: 'boardFaultLights',
    title: 'Board fault lights now?',
    helper: 'Use what you see at the board right now.',
    options: triStateOptions,
  },
  {
    key: 'blowerCallPresent',
    title: 'Blower call present?',
    helper: 'Verify the board or relay is actually receiving a fan call.',
    options: triStateOptions,
  },
  {
    key: 'capacitorCondition',
    title: 'Capacitor check for PSC',
    helper: 'Use if the blower is PSC or you strongly suspect PSC.',
    options: [
      { label: 'Looks good', value: 'good' },
      { label: 'Failed', value: 'failed' },
      { label: 'Not checked', value: 'not_checked' },
      { label: 'Not sure', value: 'not_sure' },
    ],
  },
  {
    key: 'ecmModuleClues',
    title: 'ECM module or power clues',
    helper: 'Use if the blower is ECM or you suspect ECM behavior.',
    options: [
      { label: 'Module dead', value: 'module_dead' },
      { label: 'Intermittent', value: 'intermittent' },
      { label: 'Power issue', value: 'power_issue' },
      { label: 'Not sure', value: 'not_sure' },
    ],
  },
];

export const outdoorUnitQuestions: GateQuestionConfig<TriStateAnswer>[] = [
  {
    key: 'contactorEngaged',
    title: 'Is the contactor pulled in?',
    helper: 'This helps separate high-voltage faults from control and safety faults.',
    options: triStateOptions,
  },
  {
    key: 'contactorCoilVoltagePresent',
    title: 'Do you have 24V at the contactor coil?',
    helper: 'Use this to separate no-call issues from a failed contactor or open safety.',
    options: triStateOptions,
  },
  {
    key: 'outdoorPowerPresent',
    title: 'Do you have line voltage at the unit?',
    helper: 'Confirm line power at the disconnect or contactor line side.',
    options: triStateOptions,
  },
  {
    key: 'disconnectOn',
    title: 'Is the disconnect or breaker on?',
    helper: 'Capture the obvious power state before chasing deeper load issues.',
    options: triStateOptions,
  },
  {
    key: 'fanOnlyRunning',
    title: 'Is only the fan running?',
    helper: 'Use this when the contactor is in but the compressor does not appear to start.',
    options: triStateOptions,
  },
  {
    key: 'compressorOnlyRunning',
    title: 'Is only the compressor running?',
    helper: 'Use this when the compressor is running but the condenser fan is not.',
    options: triStateOptions,
  },
  {
    key: 'outdoorLoadsBothOff',
    title: 'Are both fan and compressor off?',
    helper: 'This helps isolate a power or control-side issue when the contactor is in.',
    options: triStateOptions,
  },
];

export const lowVoltageQuestions: GateQuestionConfig<TriStateAnswer>[] = [
  {
    key: 'transformerOutputPresent',
    title: 'Is transformer output present?',
    helper: 'Confirm the 24V source exists before chasing field wiring.',
    options: triStateOptions,
  },
  {
    key: 'lowVoltageFuseIntact',
    title: 'Is the low-voltage fuse intact?',
    helper: 'A blown fuse can make the entire control path look dead.',
    options: triStateOptions,
  },
  {
    key: 'callLeavingIndoorBoard',
    title: 'Is the cooling call leaving the indoor board?',
    helper: 'Verify the Y call is actually being passed downstream.',
    options: triStateOptions,
  },
  {
    key: 'wireContinuityToOutdoor',
    title: 'Do you have continuity to the outdoor unit?',
    helper: 'This helps separate a board problem from a broken field wire.',
    options: triStateOptions,
  },
  {
    key: 'safetyCircuitClosed',
    title: 'Is the safety circuit closed?',
    helper: 'Open safeties can interrupt 24V even with a valid call.',
    options: triStateOptions,
  },
];

export const lineVoltageQuestions: GateQuestionConfig<TriStateAnswer>[] = [
  {
    key: 'breakerOrDisconnectOn',
    title: 'Is the breaker or disconnect on?',
    helper: 'Start with the obvious power state before deeper voltage checks.',
    options: triStateOptions,
  },
  {
    key: 'lineVoltageAtDisconnect',
    title: 'Do you have line voltage at the disconnect?',
    helper: 'Confirm incoming power before chasing the cabinet.',
    options: triStateOptions,
  },
  {
    key: 'lineVoltageAtContactorLineSide',
    title: 'Do you have line voltage at the contactor line side?',
    helper: 'This separates disconnect problems from cabinet-side issues.',
    options: triStateOptions,
  },
  {
    key: 'lineVoltageAtContactorLoadSide',
    title: 'Do you have line voltage at the contactor load side?',
    helper: 'Use this when the contactor is in but the loads stay dead.',
    options: triStateOptions,
  },
  {
    key: 'fusesIntact',
    title: 'Are the fuses intact?',
    helper: 'Check all outdoor power protection before condemning components.',
    options: triStateOptions,
  },
];

export const blowerDiagQuestions: GateQuestionConfig<TriStateAnswer>[] = [
  {
    key: 'blowerMotorResponding',
    title: 'Is the blower motor responding at all?',
    helper: 'Listen, feel, or observe whether the motor even attempts to start.',
    options: triStateOptions,
  },
  {
    key: 'blowerCapacitorFailed',
    title: 'Did the blower capacitor fail test?',
    helper: 'For PSC motors, this is one of the highest-value checks.',
    options: triStateOptions,
  },
  {
    key: 'blowerWheelRestricted',
    title: 'Is the blower wheel restricted or dragging?',
    helper: 'A seized wheel can mimic an electrical failure.',
    options: triStateOptions,
  },
  {
    key: 'ecmPowerPresent',
    title: 'Is ECM power present?',
    helper: 'Use for ECM platforms or when motor power is in question.',
    options: triStateOptions,
  },
  {
    key: 'ecmCommunicationPresent',
    title: 'Is ECM communication or control present?',
    helper: 'This helps separate module failure from upstream control issues.',
    options: triStateOptions,
  },
];

export const compressorDiagQuestions: GateQuestionConfig<TriStateAnswer>[] = [
  {
    key: 'compressorAmpDrawPresent',
    title: 'Is the compressor drawing amps?',
    helper: 'This quickly separates no-start from loaded-start behavior.',
    options: triStateOptions,
  },
  {
    key: 'compressorCapacitorFailed',
    title: 'Did the compressor capacitor fail test?',
    helper: 'Check the compressor section of a dual run capacitor or dedicated cap.',
    options: triStateOptions,
  },
  {
    key: 'compressorOverloadOpen',
    title: 'Is the compressor overload open?',
    helper: 'Hot overload can make the compressor stay off while the fan runs.',
    options: triStateOptions,
  },
  {
    key: 'compressorWindingIssue',
    title: 'Any winding issue indicated?',
    helper: 'Use resistance/continuity clues only if you have them.',
    options: triStateOptions,
  },
];

export const condenserFanDiagQuestions: GateQuestionConfig<TriStateAnswer>[] = [
  {
    key: 'fanMotorVoltagePresent',
    title: 'Is voltage reaching the condenser fan motor?',
    helper: 'This separates capacitor or motor issues from missing output.',
    options: triStateOptions,
  },
  {
    key: 'fanCapacitorFailed',
    title: 'Did the fan capacitor fail test?',
    helper: 'A failed fan capacitor is a high-probability branch when compressor runs alone.',
    options: triStateOptions,
  },
  {
    key: 'fanBladeSpinsFreely',
    title: 'Does the fan blade spin freely by hand?',
    helper: 'Mechanical drag can imitate an electrical issue.',
    options: triStateOptions,
  },
  {
    key: 'fanMotorOveramping',
    title: 'Is the fan motor overamping or overheating?',
    helper: 'This helps separate a weak motor from a control-side issue.',
    options: triStateOptions,
  },
];

export const routeLabels: Record<DiagnosticRouteId, string> = {
  thermostat_control_diag: 'Thermostat / control path',
  indoor_unit_diag: 'Indoor unit diagnostics',
  outdoor_unit_diag: 'Outdoor unit diagnostics',
  airflow_restriction_diag: 'Airflow restriction path',
  refrigeration_diag: 'Refrigeration path',
  icing_diag: 'Freeze-up path',
  low_voltage_diag: 'Low voltage path',
  line_voltage_diag: 'Line voltage path',
  safety_open_diag: 'Safety open path',
  blower_diag: 'Blower path',
  compressor_diag: 'Compressor path',
  condenser_fan_diag: 'Condenser fan path',
  board_control_diag: 'Board / control path',
  fallback_diagnostic: 'Fallback diagnostic path',
};
