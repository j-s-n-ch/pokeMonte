import { Box, Tab, Tabs } from "@mui/material";
import { useCallback, useState } from "react";
import EncounterSimulatorTab from "./EncounterSimulatorTab";
import GeneralPanel from "./GeneralPanel";
import { InputArea } from "./InputArea";
import NotFixedWarning from "./NotFixedWarning";
import {
	type InputAreaData,
	loadConfig,
	saveConfig,
} from "./ResearchCalcAppConfig";

const defaultData = loadConfig();

export default function ResearchCalcApp() {
	const [data, setData] = useState(defaultData);
	const [activeTab, setActiveTab] = useState(0);

	const updateState = useCallback(
		(value: Partial<InputAreaData>) => {
			const newData = { ...data, ...value };
			setData(newData);
			saveConfig(newData);
		},
		[data],
	);

	const onChange = useCallback(
		(value: Partial<InputAreaData>) => {
			updateState(value);
		},
		[updateState],
	);

	return (
		<div style={{ margin: "0 .5rem" }}>
			<Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
				<Tabs
					value={activeTab}
					onChange={(_e, v) => setActiveTab(v)}
					textColor="primary"
					indicatorColor="primary"
				>
					<Tab label="SLEEP TRACKER" />
					<Tab label="ENCOUNTER SIMULATOR" />
				</Tabs>
			</Box>

			{activeTab === 0 ? (
				<>
					<InputArea data={data} onChange={onChange} />
					<NotFixedWarning fieldIndex={data.fieldIndex} />
					<GeneralPanel data={data} />
				</>
			) : (
				<EncounterSimulatorTab />
			)}
		</div>
	);
}
