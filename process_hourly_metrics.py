import os
import glob
import json
import datetime
import pandas as pd
import numpy as np

# Config
folder = r"C:\Users\USUARIO\OneDrive\Escritorio\RUBEN DOC\NETCALL_CORTE_HORA\REPORTERO_HORA_HORA"
output_dir = r"C:\Users\USUARIO\OneDrive\Escritorio\RUBEN DOC\NETCALL_CORTE_HORA\data"

months_map = {
    'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12
}

inv_months_map = {v: k for k, v in months_map.items()}

def parse_spanish_date(date_str):
    if not isinstance(date_str, str):
        return None
    parts = date_str.lower().strip().split()
    if len(parts) == 3:
        try:
            day = int(parts[0])
            month = months_map.get(parts[1][:3])
            year = int(parts[2])
            if month:
                return datetime.date(year, month, day)
        except Exception:
            pass
    return None

def format_spanish_date(dt):
    return f"{dt.day} {inv_months_map[dt.month]} {dt.year}"

def main():
    print("--- INICIANDO COMPILACION DE DETALLE DE METRICAS ---")
    
    # 1. Load Nomina
    nomina_files = glob.glob(os.path.join(folder, "*NOMINA*.xlsx"))
    if not nomina_files:
        raise FileNotFoundError("No se encontró el archivo de nómina XLSX.")
    nomina_file = max(nomina_files, key=os.path.getmtime)
    print(f"Cargando nómina desde: {os.path.basename(nomina_file)}")
    
    df_nomina = pd.read_excel(nomina_file, sheet_name=0)
    df_nomina['USUARIO'] = df_nomina['USUARIO'].astype(str).str.strip().str.upper()
    df_nomina['SUPERVISOR'] = df_nomina['SUPERVISOR'].astype(str).str.strip().str.upper()
    df_nomina['COORDINADOR'] = df_nomina['COORDINADOR'].astype(str).str.strip().str.upper()
    df_nomina['CUARTIL'] = df_nomina['CUARTIL'].astype(str).str.strip().str.upper()
    df_nomina['ANTIGÜEDAD'] = df_nomina['ANTIGÜEDAD'].fillna("No especificado").astype(str).str.strip()
    
    # Create helper dictionary for faster lookup
    nomina_dict = {}
    for _, row in df_nomina.iterrows():
        usr = row['USUARIO']
        if usr and usr != 'NAN':
            nomina_dict[usr] = {
                'supervisor': row['SUPERVISOR'],
                'coordinador': row['COORDINADOR'],
                'cuartil': row['CUARTIL'],
                'antiguedad': row['ANTIGÜEDAD']
            }
            
    # 2. Load CSV files
    csv_files = glob.glob(os.path.join(folder, "*.csv"))
    if not csv_files:
        raise FileNotFoundError("No se encontraron archivos CSV de Dashboard Outbound.")
        
    print(f"Cargando y combinando {len(csv_files)} archivos CSV...")
    dfs = []
    for f in csv_files:
        print(f"  Cargando: {os.path.basename(f)}")
        dfs.append(pd.read_csv(f, encoding='utf-8', encoding_errors='ignore'))
    df_all = pd.concat(dfs, ignore_index=True)
    df_all['FRM_N_DNI_Asesor'] = df_all['FRM_N_DNI_Asesor'].astype(str).str.strip().str.upper()
    
    # Exclude 'No bop' orders
    df_all = df_all[df_all['Tipo_Despacho_Detalle'] != 'No bop']
    
    # Map advisor metadata
    coordinators = []
    supervisors = []
    quartils = []
    antiguedades = []
    for val in df_all['FRM_N_DNI_Asesor']:
        info = nomina_dict.get(val)
        if info:
            coordinators.append(info['coordinador'])
            supervisors.append(info['supervisor'])
            quartils.append(info['cuartil'])
            antiguedades.append(info['antiguedad'])
        else:
            coordinators.append(np.nan)
            supervisors.append(np.nan)
            quartils.append(np.nan)
            antiguedades.append(np.nan)
            
    df_all['COORDINADOR'] = coordinators
    df_all['SUPERVISOR'] = supervisors
    df_all['CUARTIL'] = quartils
    df_all['ANTIGÜEDAD'] = antiguedades
    
    # Filter to keep only orders that have coordinators/supervisors mapped
    df_all = df_all.dropna(subset=['COORDINADOR', 'SUPERVISOR'])
    
    # Clean coordinator names to avoid encoding issues
    def clean_coordinator_name(name):
        name = str(name).strip()
        if 'SOLORZANO' in name:
            return 'JOSÉ SOLORZANO'
        return name
    df_all['COORDINADOR'] = df_all['COORDINADOR'].apply(clean_coordinator_name)
    
    # Filter to keep only the campaign coordinators
    campaign_coordinators = ['EVER MALCA', 'JOSÉ SOLORZANO', 'PIERO MEDINA']
    df_all = df_all[df_all['COORDINADOR'].isin(campaign_coordinators)]
    
    # Find key dates
    print("Calculando fechas relativas (HOY, D-1, D-7, D-14, D-21)...")
    unique_dates = df_all['Fecha_Creacion'].dropna().unique()
    parsed_dates = {}
    for d in unique_dates:
        p = parse_spanish_date(d)
        if p:
            parsed_dates[p] = d
            
    if not parsed_dates:
        raise ValueError("No se pudieron parsear las fechas de la columna Fecha_Creacion.")
        
    max_dt = max(parsed_dates.keys())
    
    dt_hoy = max_dt
    dt_d1 = max_dt - datetime.timedelta(days=1)
    dt_d7 = max_dt - datetime.timedelta(days=7)
    dt_d14 = max_dt - datetime.timedelta(days=14)
    dt_d21 = max_dt - datetime.timedelta(days=21)
    
    str_hoy = parsed_dates.get(dt_hoy, format_spanish_date(dt_hoy))
    str_d1 = parsed_dates.get(dt_d1, format_spanish_date(dt_d1))
    str_d7 = parsed_dates.get(dt_d7, format_spanish_date(dt_d7))
    str_d14 = parsed_dates.get(dt_d14, format_spanish_date(dt_d14))
    str_d21 = parsed_dates.get(dt_d21, format_spanish_date(dt_d21))
    
    print(f"  HOY (D-0): {str_hoy}")
    print(f"  D-1:       {str_d1}")
    print(f"  D-7:       {str_d7}")
    print(f"  D-14:      {str_d14}")
    print(f"  D-21:      {str_d21}")
    
    # Filter only orders belonging to these 5 dates
    target_dates = [str_hoy, str_d1, str_d7, str_d14, str_d21]
    df_filtered = df_all[df_all['Fecha_Creacion'].isin(target_dates)].copy()
    
    # Keep only necessary columns for the front-end to save bandwidth and speed up load times
    cols_to_keep = [
        'Fecha_Creacion', 'Hora', 'COORDINADOR', 'SUPERVISOR', 
        'CUARTIL', 'ANTIGÜEDAD', 'Tipo_Despacho_Detalle'
    ]
    df_filtered = df_filtered[cols_to_keep]
    
    # Output structure
    output_data = {
        "metadata": {
            "hoy_date": str_hoy,
            "d1_date": str_d1,
            "d7_date": str_d7,
            "d14_date": str_d14,
            "d21_date": str_d21,
            "last_update": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        },
        "orders": df_filtered.to_dict(orient='records')
    }
    
    # Write JSON output
    os.makedirs(output_dir, exist_ok=True)
    out_file = os.path.join(output_dir, "hourly_metrics.json")
    print(f"Escribiendo {len(df_filtered)} registros consolidados en: {out_file}")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
        
    print("--- PROCESAMIENTO FINALIZADO CON ÉXITO ---")

if __name__ == "__main__":
    main()
