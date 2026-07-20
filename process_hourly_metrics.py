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
    
    # Clean coordinator names and fill NaNs to keep all records
    def clean_coordinator_name(name):
        if pd.isna(name):
            return 'OTROS'
        name = str(name).strip()
        if 'SOLORZANO' in name:
            return 'JOSÉ SOLORZANO'
        return name
    df_all['COORDINADOR'] = df_all['COORDINADOR'].apply(clean_coordinator_name)
    
    df_all['SUPERVISOR'] = df_all['SUPERVISOR'].fillna("OTROS")
    df_all['CUARTIL'] = df_all['CUARTIL'].fillna("OTROS")
    df_all['ANTIGÜEDAD'] = df_all['ANTIGÜEDAD'].fillna("OTROS")
    
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
    
    # Keep all dates within 52 days of max_dt to support D-21 for any "HOY" selected in the last 30 days
    limit_dt = max_dt - datetime.timedelta(days=52)
    allowed_date_strings = [str_val for dt, str_val in parsed_dates.items() if dt >= limit_dt]
    
    str_hoy = parsed_dates.get(max_dt, format_spanish_date(max_dt))
    str_d1 = parsed_dates.get(max_dt - datetime.timedelta(days=1), format_spanish_date(max_dt - datetime.timedelta(days=1)))
    str_d7 = parsed_dates.get(max_dt - datetime.timedelta(days=7), format_spanish_date(max_dt - datetime.timedelta(days=7)))
    str_d14 = parsed_dates.get(max_dt - datetime.timedelta(days=14), format_spanish_date(max_dt - datetime.timedelta(days=14)))
    str_d21 = parsed_dates.get(max_dt - datetime.timedelta(days=21), format_spanish_date(max_dt - datetime.timedelta(days=21)))
    
    print(f"  Max/Latest Date (D-0): {str_hoy}")
    print(f"  Allowed data range: {len(allowed_date_strings)} dates (from {limit_dt} to {max_dt})")
    
    # Filter only orders belonging to allowed range
    df_filtered = df_all[df_all['Fecha_Creacion'].isin(allowed_date_strings)].copy()
    
    # Clean/fill missing values for added columns
    df_filtered['Cruce_INAR'] = df_filtered['Cruce_INAR'].fillna("No").astype(str).str.strip()
    df_filtered['Grupo_Canal'] = df_filtered['Grupo_Canal'].fillna("Otros").astype(str).str.strip()
    df_filtered['Estado_T'] = df_filtered['Estado_T'].fillna("Otros").astype(str).str.strip()
    df_filtered['EOC_Estado'] = df_filtered['EOC_Estado'].fillna("Otros").astype(str).str.strip()
    
    # Robust Multilinea header detection and starts-with check (handles encoded characters like 'MultilÃ-nea')
    multi_col = None
    for col in df_filtered.columns:
        if 'MULTILINEA' in col.upper():
            multi_col = col
            break
            
    if multi_col:
        print(f"Detectada columna de Multilinea: {multi_col}")
        # Mark as 'SI' if string value starts with 'Mult' (case insensitive)
        df_filtered['Multilinea'] = df_filtered[multi_col].fillna("").astype(str).str.strip().str.upper().str.startswith('MULT').map({True: 'SI', False: 'NO'})
    else:
        print("ADVERTENCIA: No se detectó ninguna columna de Multilinea en el CSV.")
        df_filtered['Multilinea'] = 'NO'
    
    # Calculate ISO date strings for fast date arithmetic on frontend
    creacion_iso = []
    pactada_iso = []
    
    for _, row in df_filtered.iterrows():
        c_dt = parse_spanish_date(row['Fecha_Creacion'])
        creacion_iso.append(c_dt.strftime("%Y-%m-%d") if c_dt else "")
        p_dt = parse_spanish_date(row['Fecha_Entrega_Pactada'])
        pactada_iso.append(p_dt.strftime("%Y-%m-%d") if p_dt else "")
        
    df_filtered['Fecha_Creacion_ISO'] = creacion_iso
    df_filtered['Fecha_Pactada_ISO'] = pactada_iso
    
    # Keep only necessary columns for the front-end to save bandwidth and speed up load times
    cols_to_keep = [
        'Fecha_Creacion', 'Fecha_Creacion_ISO', 'Hora', 'COORDINADOR', 'SUPERVISOR', 
        'CUARTIL', 'ANTIGÜEDAD', 'Tipo_Despacho_Detalle', 'Multilinea', 'Cruce_INAR', 
        'Fecha_Pactada_ISO', 'Grupo_Canal', 'Estado_T', 'EOC_Estado'
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
